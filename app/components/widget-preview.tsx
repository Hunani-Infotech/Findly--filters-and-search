import type { CSSProperties } from "react";
import type { WidgetPosition } from "../app-settings";
import styles from "./widget-preview.module.css";

export type WidgetPreviewSettings = {
  widgetPosition: WidgetPosition;
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
  enableCollectionSearch?: boolean;
  hideSingleValueFacets?: boolean;
  showRefineBy?: boolean;
  autoApplyFilters?: boolean;
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
        : position === "offcanvas"
          ? styles.layoutThumbOffcanvas
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
      ) : position === "offcanvas" ? (
        <>
          <div className={styles.layoutOffcanvasBtn} />
          {products}
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
  { value: "right", label: "Vertical (right)" },
  { value: "top", label: "Horizontal" },
  { value: "offcanvas", label: "Off-canvas" },
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
                name="findlyWidgetLayout"
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

function MiniProductGrid() {
  return (
    <div className={styles.miniGrid} aria-hidden="true">
      <div className={styles.miniCard} />
      <div className={styles.miniCard} />
      <div className={styles.miniCard} />
      <div className={styles.miniCard} />
    </div>
  );
}

function FilterWidget({ settings }: { settings: WidgetPreviewSettings }) {
  const title = settings.widgetTitle.trim();
  const horizontal = settings.widgetPosition === "top";
  const collapsed =
    settings.collapseByDefault && settings.widgetPosition !== "top";
  const counts = settings.showProductCounts;
  const showRefine = settings.showRefineBy !== false;
  const hideSingle = Boolean(settings.hideSingleValueFacets);
  const offcanvas = settings.widgetPosition === "offcanvas";
  const widgetClass = [
    styles.widget,
    horizontal ? styles.widgetTop : "",
    offcanvas ? styles.widgetOffcanvas : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={widgetClass} style={widgetStyle(settings)} aria-hidden="true">
      {offcanvas ? <div className={styles.offcanvasBtn}>Filter</div> : null}
      <p className={title ? styles.title : `${styles.title} ${styles.titleHidden}`}>
        {title}
      </p>
      {settings.enableCollectionSearch ? (
        <div className={styles.collectionSearch}>Search products</div>
      ) : null}
      {showRefine ? (
        <>
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
        </>
      ) : null}
      <div className={styles.facets}>
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
      {hideSingle ? null : (
        <div className={styles.facet}>
          <div className={styles.facetLabel}>
            Material
            <span
              className={
                collapsed ? `${styles.chevron} ${styles.chevronCollapsed}` : styles.chevron
              }
            />
          </div>
          {collapsed ? null : (
            <div className={styles.option}>
              <div className={styles.check} />
              <span className={styles.optionText}>Cotton</span>
              <Count value="8" show={counts} />
            </div>
          )}
        </div>
      )}
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
      <div className={styles.facet}>
        <div className={styles.facetLabel}>
          Length
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
              <div className={styles.priceBox}>10</div>
              <div className={styles.priceBox}>100</div>
            </div>
          </>
        )}
      </div>
      </div>
      {settings.autoApplyFilters === false ? (
        <div className={styles.applyNow}>Apply now</div>
      ) : null}
    </div>
  );
}

export function WidgetLookPreview({
  settings,
}: {
  settings: WidgetPreviewSettings;
}) {
  const pos = settings.widgetPosition;
  const stageClass =
    pos === "right"
      ? `${styles.stage} ${styles.stageRight}`
      : pos === "top"
        ? `${styles.stage} ${styles.stageTop}`
        : pos === "offcanvas"
          ? `${styles.stage} ${styles.stageOffcanvas}`
          : `${styles.stage} ${styles.stageLeft}`;
  const widget = <FilterWidget settings={settings} />;
  const grid = <MiniProductGrid />;

  return (
    <div className={styles.preview}>
      <div className={styles.stageHint}>
        Approximate look on the collection page. Theme fonts apply on the
        storefront.
      </div>
      <div className={stageClass}>
        {pos === "right" ? (
          <>
            {grid}
            {widget}
          </>
        ) : (
          <>
            {widget}
            {grid}
          </>
        )}
      </div>
    </div>
  );
}
