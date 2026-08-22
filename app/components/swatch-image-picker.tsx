import { useRef, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Modal,
  Text,
  TextField,
} from "@shopify/polaris";

export type SwatchShopFile = {
  id: string;
  alt: string;
  url: string;
};

export function SwatchImagePicker({
  imageUrl,
  disabled,
  uploading,
  shopFiles,
  filesError,
  onUrlChange,
  onPickComputerFile,
  hideTrigger = false,
  open,
  onOpenChange,
}: {
  imageUrl: string;
  disabled: boolean;
  uploading: boolean;
  shopFiles: SwatchShopFile[];
  filesError: string;
  onUrlChange: (url: string) => void;
  onPickComputerFile: (file: File) => void;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const filesOpen = open ?? internalOpen;
  const setFilesOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setInternalOpen(next);
  };

  const openFilePicker = () => fileInput.current?.click();

  return (
    <BlockStack gap="300">
      {hideTrigger ? null : (
        <Button
          disabled={disabled || uploading}
          onClick={() => setFilesOpen(true)}
        >
          Choose image
        </Button>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPickComputerFile(file);
        }}
      />
      <Modal
        open={filesOpen}
        onClose={() => setFilesOpen(false)}
        title="Choose image"
        primaryAction={{
          content: "Upload from computer",
          disabled: disabled || uploading,
          loading: uploading,
          onAction: openFilePicker,
        }}
        secondaryActions={[
          { content: "Close", onAction: () => setFilesOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {filesError ? (
              <Banner tone="warning">
                <p>{filesError}</p>
              </Banner>
            ) : null}
            {uploading ? <Text as="p">Uploading…</Text> : null}
            <div className="findly-swatch-thumbs">
              <button
                type="button"
                className="findly-swatch-thumb findly-swatch-thumb--upload"
                disabled={disabled || uploading}
                onClick={openFilePicker}
              >
                Upload
              </button>
              {shopFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={
                    file.url === imageUrl
                      ? "findly-swatch-thumb findly-swatch-thumb--selected"
                      : "findly-swatch-thumb"
                  }
                  onClick={() => {
                    onUrlChange(file.url);
                    setFilesOpen(false);
                  }}
                >
                  <img src={file.url} alt={file.alt || "Swatch image"} />
                </button>
              ))}
            </div>
            {shopFiles.length === 0 && !filesError ? (
              <Text as="p">
                Upload an image from your computer. It will show here as a
                thumbnail you can reuse.
              </Text>
            ) : null}
            {hideTrigger ? null : (
              <TextField
                label="Image URL"
                autoComplete="off"
                value={imageUrl}
                disabled={disabled}
                onChange={onUrlChange}
              />
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
