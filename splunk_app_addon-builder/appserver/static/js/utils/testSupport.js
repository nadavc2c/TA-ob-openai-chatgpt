export function componentId(fileName) {
    return fileName
        .replace(/^(stage\/)?appserver\/static\/js\//, "addonbuilder/")
        .replace(/\.js?x$/, "");
}

/**
 * Returns an object that can be passed as props to a react component for setting standard test
 * hooks for automated testing.
 *
 * @param {String} fileName - The path of the file. Pass `__filename` to have webpack set this
 * dynamically at build time.
 * @param {String|Object} options - If a string is passed, it is used as the component name for the
 * test hook. Otherwise, the component name is accessed as a property of the options object. This
 * means that a components props can be passed here.
 * @returns {Object}
 */
export function createTestHook(fileName, options) {
    const componentName = typeof options === "object"
        ? options.componentName
        : options;
    return {
        "data-component": fileName && `splunk-ui:/${componentId(fileName)}`,
        "data-component-name": componentName
    };
}
