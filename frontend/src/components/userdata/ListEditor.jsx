import { useState } from "react";
import FieldGroup from "./FieldGroup";
import HelpPopover from "./HelpPopover";

function itemTitle(item, itemLabel, index) {
  const name = item?.name || item?.address || item?.employer_name || item?.account_name || null;
  return name ? `${itemLabel} — ${name}` : `${itemLabel} ${index + 1}`;
}

export default function ListEditor({ fieldDef, items, onChange }) {
  const { addLabel, itemLabel, itemGroups, description, source, calculate } = fieldDef;
  const list = Array.isArray(items) ? items : [];
  const [openCards, setOpenCards] = useState({});

  function toggleCard(i) {
    setOpenCards((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function addItem() {
    const newList = [...list, {}];
    onChange(newList);
    setOpenCards((prev) => ({ ...prev, [newList.length - 1]: true }));
  }

  function removeItem(index) {
    onChange(list.filter((_, i) => i !== index));
    setOpenCards((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  }

  function updateItem(index, newItem) {
    const newList = list.map((item, i) => (i === index ? newItem : item));
    onChange(newList);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{list.length} {list.length === 1 ? itemLabel : `${itemLabel}s`}</span>
          {(description || source) && (
            <HelpPopover fieldDef={fieldDef} />
          )}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1 rounded transition-colors"
        >
          + {addLabel}
        </button>
      </div>

      {list.length === 0 && (
        <div className="text-center text-gray-600 text-xs py-6 border border-dashed border-gray-800 rounded-lg">
          No {itemLabel?.toLowerCase()}s added yet. Click "+ {addLabel}" to begin.
        </div>
      )}

      {list.map((item, i) => (
        <div key={i} className="border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800">
            <button
              type="button"
              onClick={() => toggleCard(i)}
              className="flex-1 text-left text-sm text-gray-200 font-medium"
            >
              {itemTitle(item, itemLabel, i)}
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleCard(i)}
                className="text-gray-600 text-xs"
              >
                {openCards[i] ? "▲" : "▼"}
              </button>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-xs text-red-600 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          {openCards[i] && (
            <div className="p-3 space-y-2 bg-gray-950">
              {itemGroups.map((group) => (
                <FieldGroup
                  key={group.label}
                  label={group.label}
                  fields={group.fields}
                  data={item}
                  onChange={(updated) => updateItem(i, updated)}
                  path={group.path}
                  defaultOpen={group.defaultOpen ?? !group.advanced}
                  advanced={group.advanced}
                  showIf={group.showIf}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
