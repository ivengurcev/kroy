export function materialRequestBody(material, status = material.status) {
    const body = { ...material, status };
    delete body.id;
    delete body.siteId;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.publishedAt;
    return body;
}
