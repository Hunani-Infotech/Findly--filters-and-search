import { memo, type CSSProperties } from "react";
import type { WidgetPosition } from "../types/search";
import { sanitizeCustomCss, scopeCustomCss } from "../utils/widget-code";
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
  hideSortDropdown?: boolean;
  showTotalProductCount?: boolean;
  hideSingleValueFacets?: boolean;
  showRefineBy?: boolean;
  autoApplyFilters?: boolean;
  /** Merchant Custom CSS — sanitized + scoped for live preview. */
  customCss?: string;
};

/** Pick only fields the look preview reads so unrelated edits skip its render. */
export function toWidgetPreviewSettings(
  settings: WidgetPreviewSettings,
): WidgetPreviewSettings {
  return {
    widgetPosition: settings.widgetPosition,
    accentColor: settings.accentColor,
    showProductCounts: settings.showProductCounts,
    collapseByDefault: settings.collapseByDefault,
    widgetShadow: settings.widgetShadow,
    widgetRadius: settings.widgetRadius,
    widgetFontMode: settings.widgetFontMode,
    widgetFontFamily: settings.widgetFontFamily,
    widgetTitle: settings.widgetTitle,
    widgetTitleSize: settings.widgetTitleSize,
    widgetTitleColor: settings.widgetTitleColor,
    enableCollectionSearch: settings.enableCollectionSearch,
    hideSortDropdown: settings.hideSortDropdown,
    showTotalProductCount: settings.showTotalProductCount,
    hideSingleValueFacets: settings.hideSingleValueFacets,
    showRefineBy: settings.showRefineBy,
    autoApplyFilters: settings.autoApplyFilters,
    customCss: settings.customCss,
  };
}

type LayoutPosition = WidgetPreviewSettings["widgetPosition"];

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

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
  return <span className={cx(styles.count, "sf-option-count")}>({value})</span>;
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

function MiniProductGrid({
  showSearch = false,
  showSort = true,
  showTotal = true,
}: {
  showSearch?: boolean;
  showSort?: boolean;
  showTotal?: boolean;
}) {
  return (
    <div className={styles.miniGridCol} aria-hidden="true">
      {showSearch || showSort || showTotal ? (
        <div className={cx(styles.toolbar, "sf-toolbar")}>
          {showSearch ? (
            <div className={cx(styles.collectionSearch, "sf-search-host")}>
              Search products
            </div>
          ) : (
            <div className={styles.toolbarSpacer} />
          )}
          {showSort || showTotal ? (
            <div className={cx(styles.toolbarEnd, "sf-toolbar-end")}>
              {showSort ? (
                <div className={styles.sortRow}>
                  <span className={styles.sortLabel}>Sort by</span>
                  <div className={cx(styles.sortBy, "sf-sort-host")}>Featured</div>
                </div>
              ) : null}
              {showTotal ? (
                <div className={cx(styles.totalCount, "sf-total-count")}>
                  163 products
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div id="findly-grid-host" className={cx(styles.miniGrid, "sf-app-grid")}>
        <div className={cx(styles.miniCard, "sf-app-card")} />
        <div className={cx(styles.miniCard, "sf-app-card")} />
        <div className={cx(styles.miniCard, "sf-app-card")} />
        <div className={cx(styles.miniCard, "sf-app-card")} />
      </div>
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
  const layoutMod =
    settings.widgetPosition === "right"
      ? "smart-filter--right"
      : settings.widgetPosition === "top"
        ? "smart-filter--top"
        : settings.widgetPosition === "offcanvas"
          ? "smart-filter--offcanvas"
          : "smart-filter--left";
  const widgetClass = cx(
    styles.widget,
    "smart-filter",
    layoutMod,
    horizontal && styles.widgetTop,
    offcanvas && styles.widgetOffcanvas,
  );

  return (
    <div className={widgetClass} style={widgetStyle(settings)} aria-hidden="true">
      {offcanvas ? <div className={styles.offcanvasBtn}>Filter</div> : null}
      <p
        className={cx(
          styles.title,
          "sf-title",
          !title && styles.titleHidden,
        )}
      >
        {title}
      </p>
      {showRefine ? (
        <>
          <div className={cx(styles.filterBy, "sf-header")}>
            <span className={styles.filterByLabel}>Filter by</span>
            <span className={cx(styles.clear, "sf-clear", "sf-clear-all")}>
              Clear
            </span>
          </div>
          <div className={cx(styles.chips, "sf-chips")}>
            <span className={cx(styles.chip, "sf-chip")}>
              Availability: <span className={styles.chipStrong}>In stock</span>
              <span className={cx(styles.chipX, "sf-chip-remove")}>×</span>
            </span>
            <span className={cx(styles.chip, "sf-chip")}>
              Vendor: <span className={styles.chipStrong}>Cotton</span>
              <span className={cx(styles.chipX, "sf-chip-remove")}>×</span>
            </span>
          </div>
        </>
      ) : null}
      <div className={cx(styles.facets, "sf-facets")} data-facets="">
      <div className={cx(styles.facet, "sf-facet")}>
        <div className={cx(styles.facetLabel, "sf-facet-label")}>
          Availability
          <span
            className={cx(
              styles.chevron,
              "sf-chevron",
              collapsed && styles.chevronCollapsed,
            )}
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={cx(styles.option, "sf-option")}>
              <div className={`${styles.check} ${styles.checkOn}`} />
              <span className={cx(styles.optionText, "sf-option-text")}>
                In stock
              </span>
              <Count value="12" show={counts} />
            </div>
            <div className={cx(styles.option, "sf-option")}>
              <div className={styles.check} />
              <span className={cx(styles.optionText, "sf-option-text")}>
                Out of stock
              </span>
              <Count value="3" show={counts} />
            </div>
          </>
        )}
      </div>
      <div className={cx(styles.facet, "sf-facet")}>
        <div className={cx(styles.facetLabel, "sf-facet-label")}>
          Vendor
          <span
            className={cx(
              styles.chevron,
              "sf-chevron",
              collapsed && styles.chevronCollapsed,
            )}
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={cx(styles.option, "sf-option")}>
              <div className={`${styles.check} ${styles.checkOn}`} />
              <span className={cx(styles.optionText, "sf-option-text")}>
                Cotton
              </span>
              <Count value="8" show={counts} />
            </div>
            <div className={cx(styles.option, "sf-option")}>
              <div className={styles.check} />
              <span className={cx(styles.optionText, "sf-option-text")}>
                Linen
              </span>
              <Count value="5" show={counts} />
            </div>
            <div className={cx(styles.option, "sf-option")}>
              <div className={styles.check} />
              <span className={cx(styles.optionText, "sf-option-text")}>
                Wool
              </span>
              <Count value="4" show={counts} />
            </div>
          </>
        )}
      </div>
      {hideSingle ? null : (
        <div className={cx(styles.facet, "sf-facet")}>
          <div className={cx(styles.facetLabel, "sf-facet-label")}>
            Material
            <span
              className={cx(
                styles.chevron,
                "sf-chevron",
                collapsed && styles.chevronCollapsed,
              )}
            />
          </div>
          {collapsed ? null : (
            <div className={cx(styles.option, "sf-option")}>
              <div className={styles.check} />
              <span className={cx(styles.optionText, "sf-option-text")}>
                Cotton
              </span>
              <Count value="8" show={counts} />
            </div>
          )}
        </div>
      )}
      <div className={cx(styles.facet, "sf-facet")}>
        <div className={cx(styles.facetLabel, "sf-facet-label")}>
          Price
          <span
            className={cx(
              styles.chevron,
              "sf-chevron",
              collapsed && styles.chevronCollapsed,
            )}
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={cx(styles.slider, "sf-slider")}>
              <div className={cx(styles.sliderFill, "sf-slider-fill")} />
              <div className={`${styles.sliderThumb} ${styles.sliderThumbMin}`} />
              <div className={`${styles.sliderThumb} ${styles.sliderThumbMax}`} />
            </div>
            <div className={cx(styles.priceInputs, "sf-price")}>
              <div className={cx(styles.priceBox, "sf-price-field")}>20</div>
              <div className={cx(styles.priceBox, "sf-price-field")}>180</div>
            </div>
          </>
        )}
      </div>
      <div className={cx(styles.facet, "sf-facet")}>
        <div className={cx(styles.facetLabel, "sf-facet-label")}>
          Length
          <span
            className={cx(
              styles.chevron,
              "sf-chevron",
              collapsed && styles.chevronCollapsed,
            )}
          />
        </div>
        {collapsed ? null : (
          <>
            <div className={cx(styles.slider, "sf-slider")}>
              <div className={cx(styles.sliderFill, "sf-slider-fill")} />
              <div className={`${styles.sliderThumb} ${styles.sliderThumbMin}`} />
              <div className={`${styles.sliderThumb} ${styles.sliderThumbMax}`} />
            </div>
            <div className={cx(styles.priceInputs, "sf-price")}>
              <div className={cx(styles.priceBox, "sf-price-field")}>10</div>
              <div className={cx(styles.priceBox, "sf-price-field")}>100</div>
            </div>
          </>
        )}
      </div>
      </div>
      {settings.autoApplyFilters === false ? (
        <div className={cx(styles.applyNow, "sf-apply-now", "sf-btn", "sf-btn-primary")}>
          Apply now
        </div>
      ) : null}
    </div>
  );
}

export const WidgetLookPreview = memo(function WidgetLookPreview({
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
  const grid = (
    <MiniProductGrid showSearch={Boolean(settings.enableCollectionSearch)}
      showSort={!settings.hideSortDropdown}
      showTotal={settings.showTotalProductCount !== false}
    />
  );
  const scopedCustomCss = settings.customCss?.trim()
    ? scopeCustomCss(sanitizeCustomCss(settings.customCss))
    : "";

  return (
    <div className={styles.preview}>
      {scopedCustomCss ? (
        <style
          data-findly-preview-custom=""
          dangerouslySetInnerHTML={{ __html: scopedCustomCss }}
        />
      ) : null}
      <div className={styles.stageHint}>
        Approximate look on the collection page. Theme fonts apply on the
        storefront.
      </div>
      <div className={styles.pageFrame}>
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
    </div>
  );
});
