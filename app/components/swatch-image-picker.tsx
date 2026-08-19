import { useRef, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Modal,
  Text,
  TextField,
  Thumbnail,
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
}: {
  imageUrl: string;
  disabled: boolean;
  uploading: boolean;
  shopFiles: SwatchShopFile[];
  filesError: string;
  onUrlChange: (url: string) => void;
  onPickComputerFile: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [filesOpen, setFilesOpen] = useState(false);

  return (
    <BlockStack gap="300">
      <TextField
        label="Image URL (optional fallback)"
        autoComplete="off"
        value={imageUrl}
        disabled={disabled}
        onChange={onUrlChange}
      />
      <InlineStack gap="200" wrap>
        <Button
          disabled={disabled || uploading}
          loading={uploading}
          onClick={() => fileInput.current?.click()}
        >
          Choose from computer
        </Button>
        <Button
          disabled={disabled || uploading}
          onClick={() => setFilesOpen(true)}
        >
          Shopify files
        </Button>
      </InlineStack>
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
        title="Shopify files"
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
            {shopFiles.length === 0 && !filesError ? (
              <Text as="p">No images found in Shopify files.</Text>
            ) : (
              <BlockStack gap="200">
                {shopFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => {
                      onUrlChange(file.url);
                      setFilesOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: 8,
                      border: "1px solid #c9cccf",
                      borderRadius: 8,
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Thumbnail
                        source={file.url}
                        alt={file.alt || "Shop file"}
                        size="small"
                      />
                      <Text as="span" variant="bodyMd" truncate>
                        {file.alt || file.url}
                      </Text>
                    </InlineStack>
                  </button>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
