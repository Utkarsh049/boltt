use crate::projects::{Folder, SavedRequest};
use printpdf::*;
use printpdf::path::{PaintMode, WindingOrder};
use std::collections::HashSet;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

struct PdfContext {
    doc: PdfDocumentReference,
    font_regular: IndirectFontRef,
    font_bold: IndirectFontRef,
    font_mono: IndirectFontRef,
    pages: Vec<(PdfPageIndex, PdfLayerIndex)>,
    current_page_idx: usize,
    y: f32, // Current Y coordinate in mm
    folder_name: String,
    project_name: String,
    generated_date: String,
    is_project_level: bool,
}

fn extract_variables_from_str(input: &str, variables: &mut HashSet<String>) {
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '{' && chars.peek() == Some(&'{') {
            chars.next(); // consume second '{'
            let mut var_name = String::new();
            let mut found_close = false;
            while let Some(next_c) = chars.next() {
                if next_c == '}' && chars.peek() == Some(&'}') {
                    chars.next(); // consume second '}'
                    found_close = true;
                    break;
                }
                var_name.push(next_c);
            }
            if found_close {
                let trimmed = var_name.trim().to_string();
                if !trimmed.is_empty() {
                    variables.insert(trimmed);
                }
            }
        }
    }
}

fn collect_variables_from_request(req: &SavedRequest, variables: &mut HashSet<String>) {
    extract_variables_from_str(&req.name, variables);
    extract_variables_from_str(&req.url, variables);
    for kv in &req.headers {
        extract_variables_from_str(&kv.key, variables);
        extract_variables_from_str(&kv.value, variables);
    }
    for kv in &req.params {
        extract_variables_from_str(&kv.key, variables);
        extract_variables_from_str(&kv.value, variables);
    }
    match &req.body {
        crate::http_client::RequestBody::Json(content) => {
            extract_variables_from_str(content, variables);
        }
        crate::http_client::RequestBody::Raw(content) => {
            extract_variables_from_str(content, variables);
        }
        crate::http_client::RequestBody::FormData(rows) => {
            for kv in rows {
                extract_variables_from_str(&kv.key, variables);
                extract_variables_from_str(&kv.value, variables);
            }
        }
        crate::http_client::RequestBody::None => {}
    }
    match &req.auth {
        crate::http_client::AuthConfig::Bearer { token } => {
            extract_variables_from_str(token, variables);
        }
        crate::http_client::AuthConfig::Basic { username, password } => {
            extract_variables_from_str(username, variables);
            extract_variables_from_str(password, variables);
        }
        crate::http_client::AuthConfig::None => {}
    }
}

fn collect_folder_variables(folder: &Folder, variables: &mut HashSet<String>) {
    for req in &folder.requests {
        collect_variables_from_request(req, variables);
    }
    for sub in &folder.subfolders {
        collect_folder_variables(sub, variables);
    }
}

fn gather_requests_recursive(folder: &Folder, path: String, list: &mut Vec<(String, SavedRequest)>) {
    let current_path = if path.is_empty() {
        folder.name.clone()
    } else {
        format!("{} / {}", path, folder.name)
    };
    
    for req in &folder.requests {
        list.push((current_path.clone(), req.clone()));
    }
    
    for sub in &folder.subfolders {
        gather_requests_recursive(sub, current_path.clone(), list);
    }
}

fn wrap_text_with_code(text: &str, max_chars_per_line: usize, is_code: bool) -> Vec<String> {
    let mut lines = Vec::new();
    let max_chars = max_chars_per_line.max(1);

    for paragraph in text.split('\n') {
        if paragraph.is_empty() {
            lines.push(String::new());
            continue;
        }
        
        if is_code {
            let chars: Vec<char> = paragraph.chars().collect();
            let mut start = 0;
            while start < chars.len() {
                let end = (start + max_chars).min(chars.len());
                let line: String = chars[start..end].iter().collect();
                lines.push(line);
                start = end;
            }
        } else {
            let words: Vec<&str> = paragraph.split(' ').collect();
            let mut current_line = String::new();
            let mut current_char_count = 0;

            for word in words {
                if word.is_empty() {
                    if !current_line.is_empty() {
                        current_line.push(' ');
                        current_char_count += 1;
                    }
                    continue;
                }
                
                let word_chars: Vec<char> = word.chars().collect();
                let word_len = word_chars.len();
                
                if current_line.is_empty() {
                    if word_len <= max_chars {
                        current_line = word.to_string();
                        current_char_count = word_len;
                    } else {
                        let mut start = 0;
                        while start < word_len {
                            let end = (start + max_chars).min(word_len);
                            let chunk: String = word_chars[start..end].iter().collect();
                            if end < word_len {
                                lines.push(chunk);
                            } else {
                                current_line = chunk;
                                current_char_count = word_chars[start..end].len();
                            }
                            start = end;
                        }
                    }
                } else if current_char_count + 1 + word_len <= max_chars {
                    current_line.push(' ');
                    current_line.push_str(word);
                    current_char_count += 1 + word_len;
                } else {
                    lines.push(std::mem::take(&mut current_line));
                    current_char_count = 0;
                    
                    if word_len <= max_chars {
                        current_line = word.to_string();
                        current_char_count = word_len;
                    } else {
                        let mut start = 0;
                        while start < word_len {
                            let end = (start + max_chars).min(word_len);
                            let chunk: String = word_chars[start..end].iter().collect();
                            if end < word_len {
                                lines.push(chunk);
                            } else {
                                current_line = chunk;
                                current_char_count = word_chars[start..end].len();
                            }
                            start = end;
                        }
                    }
                }
            }
            if !current_line.is_empty() {
                lines.push(current_line);
            }
        }
    }
    lines
}

impl PdfContext {
    fn new(folder_name: String, project_name: String, generated_date: String, is_project_level: bool) -> Self {
        let (doc, page1, layer1) = PdfDocument::new("Boltt API Reference", Mm(210.0), Mm(297.0), "Layer 1");
        let font_regular = doc.add_builtin_font(BuiltinFont::Helvetica).unwrap();
        let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).unwrap();
        let font_mono = doc.add_builtin_font(BuiltinFont::Courier).unwrap();
        
        let ctx = Self {
            doc,
            font_regular,
            font_bold,
            font_mono,
            pages: vec![(page1, layer1)],
            current_page_idx: 0,
            y: 265.0,
            folder_name,
            project_name,
            generated_date,
            is_project_level,
        };
        
        ctx.draw_header(0);
        ctx
    }
    
    fn current_layer(&self) -> PdfLayerReference {
        let (page, layer) = self.pages[self.current_page_idx];
        self.doc.get_page(page).get_layer(layer)
    }
    
    fn check_page_break(&mut self, needed_mm: f32) {
        if self.y - needed_mm < 25.0 {
            let (page, layer) = self.doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
            self.pages.push((page, layer));
            self.current_page_idx += 1;
            self.y = 265.0;
            self.draw_header(self.current_page_idx);
        }
    }
    
    fn draw_header(&self, page_idx: usize) {
        let layer = self.doc.get_page(self.pages[page_idx].0).get_layer(self.pages[page_idx].1);
        
        layer.set_fill_color(Color::Rgb(Rgb::new(0.09, 0.12, 0.16, None)));
        // Project & Folder info on top right
        let subtitle = if self.is_project_level {
            format!("{} — Full Project API Reference", self.project_name)
        } else {
            format!("{} — API Reference", self.folder_name)
        };
        layer.use_text(subtitle, 9.5, Mm(85.0), Mm(280.0), &self.font_bold);
        
        let info = format!("Project: {} | Date: {}", self.project_name, self.generated_date);
        layer.use_text(info, 8.0, Mm(85.0), Mm(275.0), &self.font_regular);
        
        // Draw horizontal line separator
        let line_points = vec![
            (Point::new(Mm(20.0), Mm(271.0)), false),
            (Point::new(Mm(190.0), Mm(271.0)), false),
        ];
        let line = Line {
            points: line_points,
            is_closed: false,
        };
        layer.set_outline_thickness(0.5);
        layer.set_outline_color(Color::Rgb(Rgb::new(0.8, 0.8, 0.8, None)));
        layer.add_line(line);
        
        // Reset colors
        layer.set_fill_color(Color::Rgb(Rgb::new(0.09, 0.12, 0.16, None)));
    }
    
    fn draw_footer(&self) {
        let total_pages = self.pages.len();
        for (idx, (page, layer_idx)) in self.pages.iter().enumerate() {
            let layer = self.doc.get_page(*page).get_layer(*layer_idx);
            // Draw thin divider line at bottom
            let line_points = vec![
                (Point::new(Mm(20.0), Mm(20.0)), false),
                (Point::new(Mm(190.0), Mm(20.0)), false),
            ];
            let line = Line {
                points: line_points,
                is_closed: false,
            };
            layer.set_outline_thickness(0.3);
            layer.set_outline_color(Color::Rgb(Rgb::new(0.85, 0.85, 0.85, None)));
            layer.add_line(line);

            // Draw page numbers in footer
            let footer_text = format!("Page {} of {}", idx + 1, total_pages);
            layer.use_text(footer_text, 7.5, Mm(95.0), Mm(14.0), &self.font_regular);
            
            let copyright = "Generated by Boltt API Client";
            layer.use_text(copyright, 7.5, Mm(20.0), Mm(14.0), &self.font_regular);
        }
    }

    fn write_line(&mut self, text: &str, font_size: f32, is_bold: bool, indent_mm: f32) {
        self.check_page_break(5.0);
        let font = if is_bold { &self.font_bold } else { &self.font_regular };
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.09, 0.12, 0.16, None)));
        self.current_layer().use_text(text, font_size, Mm(20.0 + indent_mm), Mm(self.y), font);
        self.y -= 5.0;
    }

    fn write_wrapped(&mut self, text: &str, font_size: f32, is_bold: bool, is_mono: bool, indent_mm: f32, line_spacing_mm: f32) {
        let max_chars = if is_mono { 76 } else { 85 };
        let wrapped_lines = wrap_text_with_code(text, max_chars, is_mono);
        
        for line in wrapped_lines {
            self.check_page_break(line_spacing_mm);
            if !line.is_empty() {
                let font = if is_mono {
                    &self.font_mono
                } else if is_bold {
                    &self.font_bold
                } else {
                    &self.font_regular
                };
                self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.09, 0.12, 0.16, None)));
                self.current_layer().use_text(line, font_size, Mm(20.0 + indent_mm), Mm(self.y), font);
            }
            self.y -= line_spacing_mm;
        }
    }

    fn write_request_header(&mut self, method: &str, url: &str) {
        self.check_page_break(15.0);
        
        let color = match method.to_uppercase().as_str() {
            "GET" => Color::Rgb(Rgb::new(0.28, 0.80, 0.56, None)),
            "POST" => Color::Rgb(Rgb::new(0.29, 0.69, 1.0, None)),
            "PUT" => Color::Rgb(Rgb::new(0.99, 0.63, 0.19, None)),
            "PATCH" => Color::Rgb(Rgb::new(0.31, 0.89, 0.76, None)),
            "DELETE" => Color::Rgb(Rgb::new(0.96, 0.26, 0.22, None)),
            _ => Color::Rgb(Rgb::new(0.3, 0.3, 0.3, None)),
        };
        
        let badge_width = match method.to_uppercase().as_str() {
            "DELETE" => 19.5,
            "PATCH" => 17.5,
            "POST" | "HEAD" => 15.5,
            "GET" | "PUT" => 13.5,
            _ => 13.5,
        };

        // Draw solid background badge
        let rect_points = vec![
            (Point::new(Mm(20.0), Mm(self.y + 3.0)), false),
            (Point::new(Mm(20.0), Mm(self.y - 1.0)), false),
            (Point::new(Mm(20.0 + badge_width), Mm(self.y - 1.0)), false),
            (Point::new(Mm(20.0 + badge_width), Mm(self.y + 3.0)), false),
        ];
        let rect = Polygon {
            rings: vec![rect_points],
            mode: PaintMode::Fill,
            winding_order: WindingOrder::NonZero,
        };
        self.current_layer().set_fill_color(color);
        self.current_layer().add_polygon(rect);
        
        // Draw white method text inside badge
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(1.0, 1.0, 1.0, None)));
        let text_offset = (badge_width - (method.len() as f32 * 1.6)) / 2.0;
        self.current_layer().use_text(method, 8.5, Mm(20.0 + text_offset), Mm(self.y + 0.2), &self.font_bold);

        // Reset color to dark slate for URL
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.09, 0.12, 0.16, None)));
        
        let url_x = 20.0 + badge_width + 4.0;
        let max_url_chars = (((190.0 - url_x) / 1.6).floor() as isize).max(1) as usize;
        
        // Safe character-based slicing for URLs to prevent multi-byte panics
        let chars: Vec<char> = url.chars().collect();
        let wrapped_url: Vec<String> = chars
            .chunks(max_url_chars)
            .map(|c| c.iter().collect())
            .collect();
        
        for line in wrapped_url {
            self.check_page_break(5.0);
            self.current_layer().use_text(line, 9.5, Mm(url_x), Mm(self.y + 0.2), &self.font_mono);
            self.y -= 5.0;
        }
        
        self.y -= 4.0;
    }

    fn write_table_section(&mut self, title: &str, items: &[crate::http_client::KeyValue]) {
        let active_items: Vec<&crate::http_client::KeyValue> = items.iter().filter(|i| i.enabled && !i.key.is_empty()).collect();
        if active_items.is_empty() {
            return;
        }
        
        self.check_page_break(15.0);
        
        // Draw section title
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.09, 0.12, 0.16, None))); // Dark slate
        self.current_layer().use_text(title, 9.5, Mm(20.0), Mm(self.y), &self.font_bold);
        self.y -= 5.5;

        // Draw table headers background
        let header_top_y = self.y;
        let header_bottom_y = self.y - 5.5;
        
        let rect_points = vec![
            (Point::new(Mm(20.0), Mm(header_top_y)), false),
            (Point::new(Mm(20.0), Mm(header_bottom_y)), false),
            (Point::new(Mm(190.0), Mm(header_bottom_y)), false),
            (Point::new(Mm(190.0), Mm(header_top_y)), false),
        ];
        let header_rect = Polygon {
            rings: vec![rect_points],
            mode: PaintMode::Fill,
            winding_order: WindingOrder::NonZero,
        };
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.95, 0.96, 0.98, None)));
        self.current_layer().add_polygon(header_rect);
        
        // Draw header text
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.25, 0.3, 0.4, None))); // Slate gray text
        self.current_layer().use_text("KEY", 7.5, Mm(23.0), Mm(header_bottom_y + 1.5), &self.font_bold);
        self.current_layer().use_text("VALUE", 7.5, Mm(85.0), Mm(header_bottom_y + 1.5), &self.font_bold);
        
        self.y = header_bottom_y;

        // Render rows
        for item in active_items {
            let max_val_chars = 68; // Space between 85.0mm and 188.0mm
            
            // Safe character-based chunking to prevent multi-byte panics
            let wrapped_val: Vec<String> = item.value.split('\n').flat_map(|p| {
                if p.is_empty() {
                    return vec![String::new()].into_iter();
                }
                let chars: Vec<char> = p.chars().collect();
                chars
                    .chunks(max_val_chars)
                    .map(|c| c.iter().collect::<String>())
                    .collect::<Vec<String>>()
                    .into_iter()
            }).collect();
            
            // Calculate row height (based on wrapped value lines)
            let row_height_mm = (wrapped_val.len() as f32 * 4.2).max(6.0);
            
            self.check_page_break(row_height_mm + 2.0);
            
            // Draw key
            self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.12, 0.15, 0.2, None)));
            self.current_layer().use_text(&item.key, 8.0, Mm(23.0), Mm(self.y - 4.0), &self.font_bold);
            
            // Draw wrapped values
            let mut val_y = self.y - 4.0;
            for line in &wrapped_val {
                self.current_layer().use_text(line, 8.0, Mm(85.0), Mm(val_y), &self.font_mono);
                val_y -= 4.2;
            }
            
            // Move y down by row height
            self.y -= row_height_mm;
            
            // Draw horizontal row line separator
            let line_points = vec![
                (Point::new(Mm(20.0), Mm(self.y)), false),
                (Point::new(Mm(190.0), Mm(self.y)), false),
            ];
            let line = Line {
                points: line_points,
                is_closed: false,
            };
            self.current_layer().set_outline_thickness(0.2);
            self.current_layer().set_outline_color(Color::Rgb(Rgb::new(0.9, 0.9, 0.9, None)));
            self.current_layer().add_line(line);
        }
        
        // Draw outer borders for the table
        let border_points = vec![
            (Point::new(Mm(20.0), Mm(header_top_y)), false),
            (Point::new(Mm(20.0), Mm(self.y)), false),
            (Point::new(Mm(190.0), Mm(self.y)), false),
            (Point::new(Mm(190.0), Mm(header_top_y)), false),
        ];
        let outer_border = Polygon {
            rings: vec![border_points],
            mode: PaintMode::Stroke,
            winding_order: WindingOrder::NonZero,
        };
        self.current_layer().set_outline_thickness(0.4);
        self.current_layer().set_outline_color(Color::Rgb(Rgb::new(0.83, 0.86, 0.9, None)));
        self.current_layer().add_polygon(outer_border);
        
        self.y -= 5.0; // Space below table
    }

    fn write_code_box(&mut self, title: &str, content: &str) {
        let font_size = 7.5;
        let line_height_mm = 3.8;
        let max_chars = 76;
        
        // Safe character-based chunking to prevent multi-byte panics
        let lines: Vec<String> = content.split('\n').flat_map(|p| {
            if p.is_empty() {
                return vec![String::new()].into_iter();
            }
            let chars: Vec<char> = p.chars().collect();
            chars
                .chunks(max_chars)
                .map(|c| c.iter().collect::<String>())
                .collect::<Vec<String>>()
                .into_iter()
        }).collect();
        
        if lines.is_empty() {
            return;
        }
        
        let header_height = 5.5;
        let content_height = lines.len() as f32 * line_height_mm + 5.0;
        let total_box_height = header_height + content_height;
        
        self.check_page_break(total_box_height + 5.0);
        
        let top_y = self.y - 2.0;
        let bottom_y = top_y - total_box_height;
        
        // Draw main body background (Dark Charcoal)
        let rect_points = vec![
            (Point::new(Mm(22.0), Mm(top_y)), false),
            (Point::new(Mm(22.0), Mm(bottom_y)), false),
            (Point::new(Mm(188.0), Mm(bottom_y)), false),
            (Point::new(Mm(188.0), Mm(top_y)), false),
        ];
        let rect = Polygon {
            rings: vec![rect_points],
            mode: PaintMode::FillStroke,
            winding_order: WindingOrder::NonZero,
        };
        
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.09, 0.11, 0.14, None))); // Dark charcoal
        self.current_layer().set_outline_color(Color::Rgb(Rgb::new(0.18, 0.22, 0.27, None))); // Dark slate border
        self.current_layer().set_outline_thickness(0.4);
        self.current_layer().add_polygon(rect);
        
        // Draw header background (slightly lighter dark gray)
        let divider_y = top_y - header_height;
        let header_points = vec![
            (Point::new(Mm(22.0), Mm(top_y)), false),
            (Point::new(Mm(22.0), Mm(divider_y)), false),
            (Point::new(Mm(188.0), Mm(divider_y)), false),
            (Point::new(Mm(188.0), Mm(top_y)), false),
        ];
        let header_rect = Polygon {
            rings: vec![header_points],
            mode: PaintMode::Fill,
            winding_order: WindingOrder::NonZero,
        };
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.14, 0.17, 0.22, None))); // Lighter dark header
        self.current_layer().add_polygon(header_rect);
        
        // Draw header title text
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.68, 0.72, 0.8, None))); // Silver gray
        self.current_layer().use_text(title, 7.5, Mm(25.0), Mm(top_y - 3.8), &self.font_bold);
        
        // Draw divider line
        let div_points = vec![
            (Point::new(Mm(22.0), Mm(divider_y)), false),
            (Point::new(Mm(188.0), Mm(divider_y)), false),
        ];
        let divider = Line {
            points: div_points,
            is_closed: false,
        };
        self.current_layer().set_outline_color(Color::Rgb(Rgb::new(0.18, 0.22, 0.27, None)));
        self.current_layer().set_outline_thickness(0.4);
        self.current_layer().add_line(divider);
        
        // Draw code content
        self.current_layer().set_fill_color(Color::Rgb(Rgb::new(0.63, 0.82, 1.0, None))); // Light cyan code text
        let mut curr_y = divider_y - 3.5;
        for line in lines {
            self.current_layer().use_text(line, font_size, Mm(25.0), Mm(curr_y), &self.font_mono);
            curr_y -= line_height_mm;
        }
        
        self.y = bottom_y - 6.0;
    }

    fn write_divider_rule(&mut self) {
        self.check_page_break(15.0);
        self.y -= 6.0;
        let line_points = vec![
            (Point::new(Mm(20.0), Mm(self.y)), false),
            (Point::new(Mm(190.0), Mm(self.y)), false),
        ];
        let line = Line {
            points: line_points,
            is_closed: false,
        };
        self.current_layer().set_outline_thickness(0.3);
        self.current_layer().set_outline_color(Color::Rgb(Rgb::new(0.9, 0.9, 0.9, None)));
        self.current_layer().add_line(line);
        self.y -= 8.0;
    }
}

pub fn generate_pdf_document(
    folder: &Folder,
    project_name: String,
    generated_date: String,
    save_path: &Path,
    is_project_level: bool,
) -> Result<(), String> {
    let mut ctx = PdfContext::new(folder.name.clone(), project_name, generated_date, is_project_level);

    // 1. Gather variables from all requests recursively
    let mut variables = HashSet::new();
    collect_folder_variables(folder, &mut variables);

    // 2. Render Variables Section if any are found
    if !variables.is_empty() {
        ctx.write_line("Referenced Variables", 12.0, true, 0.0);
        ctx.y -= 1.0;
        
        ctx.write_wrapped(
            "The following environment variables are referenced in this collection. For security, their actual values are omitted from this export document.",
            9.0,
            false,
            false,
            0.0,
            4.2,
        );
        ctx.y -= 2.0;

        for var in &variables {
            ctx.check_page_break(5.5);
            ctx.current_layer().use_text("•", 9.0, Mm(22.0), Mm(ctx.y), &ctx.font_regular);
            ctx.current_layer().use_text(format!("{{{{{}}}}}", var), 8.5, Mm(25.0), Mm(ctx.y), &ctx.font_bold);
            ctx.current_layer().use_text("Runtime substituted environment placeholder", 8.0, Mm(80.0), Mm(ctx.y), &ctx.font_regular);
            ctx.y -= 5.0;
        }
        
        ctx.y -= 4.0;
        ctx.write_divider_rule();
    }

    // 3. Gather all requests recursively
    let mut request_list = Vec::new();
    gather_requests_recursive(folder, String::new(), &mut request_list);

    if request_list.is_empty() {
        ctx.write_line("This folder contains no requests.", 10.0, false, 0.0);
    } else {
        for (idx, (folder_path, req)) in request_list.iter().enumerate() {
            if idx > 0 {
                ctx.write_divider_rule();
            }

            // Folder path context
            ctx.write_line(&format!("Folder Path: {}", folder_path), 8.0, false, 0.0);
            ctx.y -= 2.0;

            // Request Name
            ctx.write_line(&req.name, 12.0, true, 0.0);
            ctx.y -= 2.0;

            // Method + URL line
            let method_str = format!("{:?}", req.method);
            ctx.write_request_header(&method_str, &req.url);

            // Params Table
            ctx.write_table_section("Query Parameters", &req.params);

            // Headers Table
            ctx.write_table_section("Request Headers", &req.headers);

            // Auth details
            match &req.auth {
                crate::http_client::AuthConfig::Bearer { token } => {
                    ctx.check_page_break(10.0);
                    ctx.write_line("Authorization", 9.0, true, 0.0);
                    ctx.y -= 1.0;
                    ctx.write_line(&format!("Bearer Token: {}", token), 8.5, false, 4.0);
                    ctx.y -= 2.0;
                }
                crate::http_client::AuthConfig::Basic { username, password: _ } => {
                    ctx.check_page_break(12.0);
                    ctx.write_line("Authorization", 9.0, true, 0.0);
                    ctx.y -= 1.0;
                    ctx.write_line(&format!("Basic Username: {}", username), 8.5, false, 4.0);
                    ctx.write_line("Basic Password: [Masked / Hidden]", 8.5, false, 4.0);
                    ctx.y -= 2.0;
                }
                crate::http_client::AuthConfig::None => {}
            }

            // Body
            match &req.body {
                crate::http_client::RequestBody::Json(content) => {
                    ctx.write_code_box("Request Body (application/json)", content);
                }
                crate::http_client::RequestBody::Raw(content) => {
                    ctx.write_code_box("Request Body (text/plain)", content);
                }
                crate::http_client::RequestBody::FormData(rows) => {
                    ctx.write_table_section("Multipart Form Data", rows);
                }
                crate::http_client::RequestBody::None => {}
            }
        }
    }

    // 4. Draw page numbers in footer
    ctx.draw_footer();

    // 5. Save document to target path
    let file = File::create(save_path)
        .map_err(|e| format!("Failed to create output PDF file: {}", e))?;
    let mut writer = BufWriter::new(file);
    ctx.doc.save(&mut writer)
        .map_err(|e| format!("Failed to serialize PDF: {}", e))?;

    Ok(())
}
