
function publicProps(part, props, contacts) {
    if (!contacts) return props;

    if (part === '@kroy/hero' || part === '@kroy/links') {
        return { ...props, socials: contacts.socials };
    }

    if (part === '@kroy/contacts') {
        return { ...props, ...contacts };
    }

    return props;
}

export default function Page({ content, parts, contacts }) {
    return content.map(({ id, part, props }, index) => {
        const Component = parts[part];

        if (!Component) {
            throw new Error(`Запчасть не найдена: ${part}`);
        }

        return <Component key={id ?? index} {...publicProps(part, props, contacts)} />;
    });
}
