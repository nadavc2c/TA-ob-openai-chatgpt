const colorPalatte = [
    "#d1e69f",
    "#fae3a9",
    "#e6a8b4",
    "#b7dced",
    "#f7c8a9",
    "#f6dad4",
    "#c3bed8",
    "#9edae5",
    "#c49c94",
    "#c7c7c7",
    "#2ca02c",
    "#bcbd22",
    "#d62728",
    "#1f77b4",
    "#ff7f0e",
    "#e377c2",
    "#9467bd",
    "#17becf",
    "#8c564b",
    "#7f7f7f"
];

const cpLength = colorPalatte.length;

const getBackgroundColor = function(index) {
    return colorPalatte[index % cpLength];
};
const getTextColor = function(index) {
    return index % cpLength < 10 ? "#000" : "#fff";
};
const getColorGroupIndex = function(index) {
    return index % cpLength;
};
export { colorPalatte, getBackgroundColor, getTextColor, getColorGroupIndex };
