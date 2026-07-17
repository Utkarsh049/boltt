import React from "react";
import { KeyValue } from "../../store/requestStore";
import { Trash2 } from "lucide-react";

interface KVEditorProps {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export const KVEditor: React.FC<KVEditorProps> = ({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}) => {
  const handleRowChange = (index: number, field: keyof KeyValue, val: any) => {
    const updated = rows.map((row, idx) => {
      if (idx === index) {
        return { ...row, [field]: val };
      }
      return row;
    });
    onChange(updated);
  };

  const handleRowDelete = (index: number) => {
    const updated = rows.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleVirtualRowChange = (field: "key" | "value", val: string) => {
    if (!val) return;
    const newRow: KeyValue = {
      key: field === "key" ? val : "",
      value: field === "value" ? val : "",
      enabled: true,
    };
    onChange([...rows, newRow]);
  };

  const hasVariable = (val: string) => {
    return val.includes("{{") && val.includes("}}");
  };

  // Determine display rows: if rows is empty or the last row is not empty, append a virtual blank row
  const hasTrailingBlank =
    rows.length > 0 &&
    rows[rows.length - 1].key === "" &&
    rows[rows.length - 1].value === "";

  const displayRows = hasTrailingBlank
    ? rows
    : [...rows, { key: "", value: "", enabled: true }];

  return (
    <div className="w-full flex flex-col font-mono text-xs">
      {/* Header column labels */}
      <div className="flex items-center border-b border-border-primary bg-bg-secondary text-text-secondary py-1">
        <div className="w-8 flex justify-center">
          {/* Checkbox column spacer */}
        </div>
        <div className="flex-1 px-2 border-r border-border-primary">Key</div>
        <div className="flex-1 px-2">Value</div>
        <div className="w-8">
          {/* Action column spacer */}
        </div>
      </div>

      {/* Rows List */}
      <div className="flex flex-col divide-y divide-border-primary">
        {displayRows.map((row, index) => {
          const isVirtual = index === rows.length;
          const keyHasVar = hasVariable(row.key);
          const valHasVar = hasVariable(row.value);

          return (
            <div
              key={index}
              className={`flex items-center group py-1 ${
                isVirtual ? "bg-bg-primary" : "bg-bg-primary"
              }`}
            >
              {/* Checkbox Toggle */}
              <div className="w-8 flex justify-center">
                {isVirtual ? (
                  <input
                    type="checkbox"
                    disabled
                    checked={false}
                    className="w-3.5 h-3.5 rounded-sm border-border-primary bg-bg-secondary/30 cursor-not-allowed opacity-30"
                  />
                ) : (
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => handleRowChange(index, "enabled", e.target.checked)}
                    className="w-3.5 h-3.5 rounded-sm border-border-primary bg-bg-tertiary text-text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                )}
              </div>

              {/* Key Input */}
              <div className="flex-1 border-r border-border-primary">
                <input
                  type="text"
                  value={row.key}
                  placeholder={isVirtual ? `Add ${keyPlaceholder.toLowerCase()}` : keyPlaceholder}
                  onChange={(e) =>
                    isVirtual
                      ? handleVirtualRowChange("key", e.target.value)
                      : handleRowChange(index, "key", e.target.value)
                  }
                  className={`w-full bg-transparent text-text-primary px-2 py-0.5 border-0 focus:outline-none focus:ring-0 ${
                    isVirtual ? "opacity-50 focus:opacity-100" : ""
                  } ${keyHasVar ? "text-amber-300 font-semibold" : ""}`}
                />
              </div>

              {/* Value Input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={row.value}
                  placeholder={isVirtual ? `Add ${valuePlaceholder.toLowerCase()}` : valuePlaceholder}
                  onChange={(e) =>
                    isVirtual
                      ? handleVirtualRowChange("value", e.target.value)
                      : handleRowChange(index, "value", e.target.value)
                  }
                  className={`w-full bg-transparent text-text-primary px-2 py-0.5 border-0 focus:outline-none focus:ring-0 ${
                    isVirtual ? "opacity-50 focus:opacity-100" : ""
                  } ${valHasVar ? "text-amber-300 font-semibold bg-amber-950/10 rounded-sm" : ""}`}
                />
              </div>

              {/* Delete Button */}
              <div className="w-8 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {!isVirtual && (
                  <button
                    onClick={() => handleRowDelete(index)}
                    className="text-text-secondary hover:text-red-400 focus:outline-none flex items-center justify-center p-1 cursor-pointer"
                    title="Delete Row"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
