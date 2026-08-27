import {
  INSTANT_LAYOUT_LABELS,
  INSTANT_LAYOUTS,
  type InstantLayout,
} from "../utils/instant-search";

export function InstantLayoutPicker({
  value,
  disabled = false,
  onChange,
}: {
  value: InstantLayout;
  disabled?: boolean;
  onChange: (value: InstantLayout) => void;
}) {
  return (
    <div
      className="findly-instant-layout-grid"
      role="radiogroup"
      aria-label="Search widget layout"
    >
      {INSTANT_LAYOUTS.map((layout) => {
        const selected = value === layout;
        return (
          <label
            key={layout}
            className={`findly-instant-layout-card${
              selected ? " findly-instant-layout-card--selected" : ""
            }${disabled ? " findly-instant-layout-card--disabled" : ""}`}
          >
            <div
              className={`findly-instant-layout-thumb findly-instant-layout-thumb--${layout}`}
              aria-hidden="true"
            >
              <div className="findly-instant-layout-bar" />
              <div className="findly-instant-layout-body">
                {layout === "dropdown_two" ? (
                  <>
                    <div className="findly-instant-layout-col" />
                    <div className="findly-instant-layout-col" />
                  </>
                ) : (
                  <div className="findly-instant-layout-col" />
                )}
              </div>
            </div>
            <span className="findly-instant-layout-choice">
              <input
                className="findly-instant-layout-radio"
                type="radio"
                name="instant-layout"
                value={layout}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(layout)}
              />
              {INSTANT_LAYOUT_LABELS[layout]}
            </span>
          </label>
        );
      })}
    </div>
  );
}
