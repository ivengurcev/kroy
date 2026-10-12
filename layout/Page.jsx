
export default function Page({ content, parts }) {
    return content.map(({ id, part, props }, index) => {
        const Component = parts[part];

        if (!Component) {
            throw new Error(`Запчасть не найдена: ${part}`);
        }

        return <Component key={id ?? index} {...props} />;
    });
}
