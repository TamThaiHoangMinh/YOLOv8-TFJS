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

// Combine this with "es6-string-html" to get a nice syntax and color for HTML instead of single color text
const html = (strings, ...values) =>
    String.raw(strings, ...values)
        .split('\n')
        .map(line => line.trim())
        .join('');

const YOLOv8_TFJS = async (box) => {
    // widget provides a user interface to interact with the simulator
    const main_container = document.createElement("div");
    main_container.className = "flex w-full h-full overflow-hidden";
    main_container.innerHTML = html`
    <div>HelloWorld</div>
    `
    box.injectNode(main_container);
}

const plugin = async ({ widgets, simulator, vehicle }) => {
    widgets.register('YOLOv8_TFJS_Widget', (box) => { YOLOv8_TFJS(box) })
}

export default plugin;