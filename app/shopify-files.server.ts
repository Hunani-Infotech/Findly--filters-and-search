type GraphqlAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type ShopFile = {
  id: string;
  alt: string;
  url: string;
};

async function readGraphql(response: Response) {
  return (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string }>;
  };
}

export async function listShopImages(
  admin: GraphqlAdmin,
  query = "",
): Promise<ShopFile[]> {
  const response = await admin.graphql(
    `#graphql
    query FindlyShopImages($first: Int!, $query: String) {
      files(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          alt
          ... on MediaImage {
            image { url }
          }
          ... on GenericFile {
            url
          }
        }
      }
    }`,
    {
      variables: {
        first: 24,
        query: query.trim() || "media_type:IMAGE",
      },
    },
  );
  const json = await readGraphql(response);
  const graphqlError = json.errors?.[0]?.message;
  if (graphqlError) {
    throw new Error(graphqlError);
  }
  const nodes =
    ((json.data?.files as { nodes?: Array<Record<string, unknown>> } | undefined)
      ?.nodes) ?? [];
  return nodes
    .map((node) => {
      const image = node.image as { url?: string } | undefined;
      const url = String(image?.url || node.url || "");
      return {
        id: String(node.id || ""),
        alt: String(node.alt || ""),
        url,
      };
    })
    .filter((file) => file.url);
}

export async function uploadShopImage(
  admin: GraphqlAdmin,
  file: { filename: string; mimeType: string; bytes: Buffer },
): Promise<{ url: string } | { error: string }> {
  const filename = file.filename.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "swatch.png";
  const mimeType = file.mimeType || "image/png";
  const staged = await admin.graphql(
    `#graphql
    mutation FindlyStagedUploads($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: [
          {
            filename,
            mimeType,
            httpMethod: "POST",
            resource: "FILE",
            fileSize: String(file.bytes.length),
          },
        ],
      },
    },
  );
  const stagedJson = await readGraphql(staged);
  const payload = stagedJson.data?.stagedUploadsCreate as
    | {
        stagedTargets?: Array<{
          url?: string;
          resourceUrl?: string;
          parameters?: Array<{ name: string; value: string }>;
        }>;
        userErrors?: Array<{ message?: string }>;
      }
    | undefined;
  const err = payload?.userErrors?.[0]?.message || stagedJson.errors?.[0]?.message;
  if (err) return { error: err };
  const target = payload?.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl) {
    return { error: "Could not prepare the Shopify file upload." };
  }

  const form = new FormData();
  for (const param of target.parameters ?? []) {
    form.append(param.name, param.value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(file.bytes)], { type: mimeType }),
    filename,
  );
  const uploaded = await fetch(target.url, { method: "POST", body: form });
  if (!uploaded.ok) {
    return { error: `Upload failed (${uploaded.status}).` };
  }

  const created = await admin.graphql(
    `#graphql
    mutation FindlyFileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          alt
          ... on MediaImage { image { url } }
          ... on GenericFile { url }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        files: [
          {
            originalSource: target.resourceUrl,
            contentType: "IMAGE",
            alt: filename,
          },
        ],
      },
    },
  );
  const createdJson = await readGraphql(created);
  const filePayload = createdJson.data?.fileCreate as
    | {
        files?: Array<{
          id?: string;
          image?: { url?: string };
          url?: string;
        }>;
        userErrors?: Array<{ message?: string }>;
      }
    | undefined;
  const createErr =
    filePayload?.userErrors?.[0]?.message || createdJson.errors?.[0]?.message;
  if (createErr) return { error: createErr };

  let url =
    filePayload?.files?.[0]?.image?.url || filePayload?.files?.[0]?.url || "";
  const fileId = filePayload?.files?.[0]?.id;
  if (!url && fileId) {
    for (let attempt = 0; attempt < 6 && !url; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const poll = await admin.graphql(
        `#graphql
        query FindlyFileUrl($id: ID!) {
          node(id: $id) {
            ... on MediaImage { image { url } }
            ... on GenericFile { url }
          }
        }`,
        { variables: { id: fileId } },
      );
      const pollJson = await readGraphql(poll);
      const node = pollJson.data?.node as
        | { image?: { url?: string }; url?: string }
        | undefined;
      url = String(node?.image?.url || node?.url || "");
    }
  }
  if (!url && target.resourceUrl) {
    url = target.resourceUrl;
  }
  if (!url) {
    return {
      error:
        "File uploaded, but Shopify has not published a URL yet. Approve read_files/write_files and try again.",
    };
  }
  return { url };
}
