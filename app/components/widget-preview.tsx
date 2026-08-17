import type { CSSProperties } from "react";
import styles from "./widget-preview.module.css";

export type WidgetPreviewSettings = {
  widgetPosition: "left" | "right" | "top";
  accentColor: string;
  showProductCounts: boolean;
  collapseByDefault: boolean;
  widgetShadow: boolean;
  widgetRadius: number;
  widgetFontMode: "theme" | "heading" | "body" | "custom";
  widgetFontFamily: string;
  widgetTitle: string;
  widgetTitleSize: number;
  widgetTitleColor: string;
};

type LayoutPosition = WidgetPreviewSettings["widgetPosition"];

function widgetStyle(settings: WidgetPreviewSettings): CSSProperties {
  const custom =
    settings.widgetFontMode === "custom" && settings.widgetFontFamily.trim()
      ? settings.widgetFontFamily.trim()
      : "inherit";
  return {
    "--sf-accent": settings.accentColor || "#1c1917",
    "--sf-radius": `${settings.widgetRadius}px`,
    "--sf-shadow": settings.widgetShadow
      ? "0 8px 24px rgb(28 25 23 / 6%)"
      : "none",
    "--sf-title-size": `${settings.widgetTitleSize}px`,
    "--sf-title-color": settings.widgetTitleColor,
    "--sf-font-body": custom,
    "--sf-font-heading": custom,
  } as CSSProperties;
}

function Count({
  value,
  show,
}: {
  value: string;
  show: boolean;
}) {
  if (!show) return null;
  return <span className={styles.count}>({value})</span>;
}

function LayoutThumb({ position }: { position: LayoutPosition }) {
  const modifier =
    position === "right"
      ? styles.layoutThumbRight
      : position === "top"
        ? styles.layoutThumbTop
        : styles.layoutThumbLeft;
  const filter = <div className={styles.layoutFilter} />;
  const products = (
    <div className={styles.layoutProducts}>
      <div className={styles.layoutProduct} />
      <div className={styles.layoutProduct} />
      <div className={styles.layoutProduct} />
      <div className={styles.layoutProduct} />
    </div>
  );

  return (
    <div className={`${styles.layoutThumb} ${modifier}`} aria-hidden="true">
      {position === "right" ? (
        <>
          {products}
          {filter}
        </>
      ) : (
        <>
          {filter}
          {products}
        </>
      )}
    </div>
  );
}

const LAYOUT_OPTIONS: {
  value: LayoutPosition;
  label: string;
}[] = [
  { value: "left", label: "Vertical" },
  { value: "top", label: "Horizontal" },
  { value: "right", label: "Right sidebar" },
];

export function LayoutPicker({
  value,
  disabled = false,
  onChange,
}: {
  value: LayoutPosition;
  disabled?: boolean;
  onChange: (value: LayoutPosition) => void;
}) {
  return (
    <div className={styles.layoutGrid} role="radiogroup" aria-label="Filter layout">
      {LAYOUT_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={`${styles.layoutCard} ${
              selected ? styles.layoutCardSelected : ""
            } ${disabled ? styles.layoutCardDisabled : ""}`}
          >
            <LayoutThumb position={option.value} />
            <span className={styles.layoutChoice}>
              <input
                className={styles.layoutRadio}
                type="radio"
                name="filter-layout"
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function FilterWidget({ settings }: { settings: WidgetPreviewSettings }) {
  const title = settings.widgetTitle.trim();
  const collapsed = settings.collapseByDefault;
  const counts = settings.showProductCounts;

  return (
    <div className={styles.widget} style={widgetStyle(settings)} aria-hidden="true">
      <p className={title ? styles.title : `${styles.title} ${styles.titleHidden}`}>
        {title}
      </p>
      <div className={styles.filterBy}>
        <span className={styles.filterByLabel}>Filter by</span>
        <span className={styles.clear}>Clear</span>
      </div>
      <div className={styles.chips}>
        <span className={styles.chip}>
          Availability: <span className={styles.chipStrong}>In stock</span>
          <span className={styles.chipX}>×</span>
        </span>
        <span className={styles.chip}>
          Vendor: <span className={styles.chipStrong}>Cotton</span>
          <span className={styles.chipX}>×</span>
        </span>
      </div>
      <div className={styles.facet}>
        <div className={styles.facetLabel}>
          Availability
          <span
            className={
              collapsed ? `${styles.chevron} ${styles.chevronCollapsed}` : styles.chevron
            }
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={styles.option}>
              <div className={`${styles.check} ${styles.checkOn}`} />
              <span className={styles.optionText}>In stock</span>
              <Count value="12" show={counts} />
            </div>
            <div className={styles.option}>
              <div className={styles.check} />
              <span className={styles.optionText}>Out of stock</span>
              <Count value="3" show={counts} />
            </div>
          </>
        )}
      </div>
      <div className={styles.facet}>
        <div className={styles.facetLabel}>
          Vendor
          <span
            className={
              collapsed ? `${styles.chevron} ${styles.chevronCollapsed}` : styles.chevron
            }
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={styles.option}>
              <div className={`${styles.check} ${styles.checkOn}`} />
              <span className={styles.optionText}>Cotton</span>
              <Count value="8" show={counts} />
            </div>
            <div className={styles.option}>
              <div className={styles.check} />
              <span className={styles.optionText}>Linen</span>
              <Count value="5" show={counts} />
            </div>
            <div className={styles.option}>
              <div className={styles.check} />
              <span className={styles.optionText}>Wool</span>
              <Count value="4" show={counts} />
            </div>
          </>
        )}
      </div>
      <div className={styles.facet}>
        <div className={styles.facetLabel}>
          Price
          <span
            className={
              collapsed ? `${styles.chevron} ${styles.chevronCollapsed}` : styles.chevron
            }
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={styles.slider}>
              <div className={styles.sliderFill} />
              <div className={`${styles.sliderThumb} ${styles.sliderThumbMin}`} />
              <div className={`${styles.sliderThumb} ${styles.sliderThumbMax}`} />
            </div>
            <div className={styles.priceInputs}>
              <div className={styles.priceBox}>20</div>
              <div className={styles.priceBox}>180</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WidgetLookPreview({
  settings,
}: {
  settings: WidgetPreviewSettings;
}) {
  return (
    <div className={styles.preview}>
      <div className={styles.stageHint}>
        Approximate look on the collection page. Theme fonts apply on the
        storefront.
      </div>
      <FilterWidget settings={settings} />
    </div>
  );
}
