/** Seed a FilterConfig tree for verify scripts (D1: no unique shopId+collectionGid). */
export async function seedFilterConfig(prisma, shopId, data) {
  const collectionGid = data.collectionGid ?? "";
  const fields = { ...data };
  delete fields.collectionGid;

  if (collectionGid) {
    const join = await prisma.filterTreeCollection.findFirst({
      where: { shopId, collectionGid },
    });
    let treeId = join?.treeId;
    if (!treeId) {
      const legacy = await prisma.filterConfig.findFirst({
        where: { shopId, collectionGid },
        orderBy: { createdAt: "desc" },
      });
      treeId = legacy?.id;
    }
    if (!treeId) {
      const tree = await prisma.filterConfig.create({
        data: {
          shopId,
          collectionGid,
          name: fields.name ?? "Collection filter",
          appliesToSearch: fields.appliesToSearch ?? false,
          ...fields,
        },
      });
      await prisma.filterTreeCollection.create({
        data: { shopId, treeId: tree.id, collectionGid },
      });
      return tree;
    }
    const tree = await prisma.filterConfig.update({
      where: { id: treeId },
      data: { ...fields, collectionGid },
    });
    await prisma.filterTreeCollection.upsert({
      where: { treeId_collectionGid: { treeId, collectionGid } },
      create: { shopId, treeId, collectionGid },
      update: {},
    });
    return tree;
  }

  let tree = await prisma.filterConfig.findFirst({
    where: { shopId, appliesToSearch: true },
    orderBy: { createdAt: "desc" },
  });
  if (!tree) {
    tree = await prisma.filterConfig.findFirst({
      where: { shopId, collectionGid: "" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (tree) {
    return prisma.filterConfig.update({
      where: { id: tree.id },
      data: { ...fields, appliesToSearch: true, collectionGid: "" },
    });
  }
  return prisma.filterConfig.create({
    data: {
      shopId,
      collectionGid: "",
      name: fields.name ?? "Default",
      appliesToSearch: true,
      ...fields,
    },
  });
}
