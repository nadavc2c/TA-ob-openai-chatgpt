define(["lib/lodash", "swc-aob/index"], function(_, SwcIndex) {
    // use underscore's mixin functionality to add the ability to localize a string
    const i18n = SwcIndex.i18n
    
    _.mixin(
        {
            t: function(string) {
                return i18n._(string);
            }
        },
        {
            chain: false
        }
    );

    return _.noConflict();
});
