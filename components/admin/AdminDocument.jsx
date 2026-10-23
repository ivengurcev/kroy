import PropTypes from 'prop-types';

export default function AdminDocument({ children, scripts, styles, title, apiData }) {
    return (
        <html lang="ru">
            <head>
                <meta charSet="UTF-8" />
                <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
                <link rel="icon" href="/static/favicon.ico" sizes="any" />
                <link rel="apple-touch-icon" href="/static/apple-touch-icon.png" />
                {apiData && (
                    <script
                        type="application/json"
                        id="api-data"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(apiData) }}
                    />
                )}
                {(styles || []).map((style) => (
                    <link key={style} rel="stylesheet" href={style} />
                ))}
                {(scripts || []).map((scriptPath) => (
                    <script type="module" key={scriptPath} defer src={scriptPath} />
                ))}
                {title && <title>{title}</title>}
            </head>
            <body>
                <div id="root">{children}</div>
            </body>
        </html>
    );
}

AdminDocument.propTypes = {
    children: PropTypes.node,
    scripts: PropTypes.arrayOf(PropTypes.string),
    styles: PropTypes.arrayOf(PropTypes.string),
    title: PropTypes.string,
    apiData: PropTypes.any,
};
