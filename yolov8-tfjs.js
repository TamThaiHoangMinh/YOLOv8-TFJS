// To load script from CDN, we need to use a window object that is not the same as the one in the plugin
const loadScript = (boxWindow, url) => {
    return new Promise(async (resolve, reject) => {
        try {
            const script = boxWindow.document.createElement("script");
            script.defer = true;
            script.referrerPolicy = "origin"

            script.src = url;
            boxWindow.document.head.appendChild(script);
            script.addEventListener("load", () => resolve(undefined));
        } catch (e) {
            reject();
        }
    });
}

const loadReact = async (boxWindow) => {
    await loadScript(boxWindow, `https://unpkg.com/react@17/umd/react.production.min.js`);
    await loadScript(boxWindow, `https://unpkg.com/react-dom@17/umd/react-dom.production.min.js`);
};

const YOLOv8_TFJS = async (box) => {
    await loadScript(box.window, `https://cdn.tailwindcss.com`); // Load tailwind css CDN
    await loadReact(box.window); // Load React and ReactDOM

    const YOLOv8_TFJS_Component = box.window.React.createElement(
        'div',
        { className: 'flex w-full h-full overflow-hidden' },
        box.window.React.createElement('div', null, 'HelloWorld')
    );

    const container = box.window.document.createElement('div');
    box.injectNode(container);

    box.window.ReactDOM.render(YOLOv8_TFJS_Component, container);
}

const plugin = async ({ widgets, simulator, vehicle }) => {
    widgets.register('YOLOv8_TFJS_Widget', (box) => { YOLOv8_TFJS(box) })
}

export default plugin;
