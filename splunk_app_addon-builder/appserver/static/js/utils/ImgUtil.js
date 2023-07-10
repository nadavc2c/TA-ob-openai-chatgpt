import { getURLPrefix, getCurrentApp } from "app/utils/AppInfo";

const getImgUrl = function(postfix) {
    return (
        getURLPrefix() + "/static/app/" + getCurrentApp() + "/img/" + postfix
    );
};

export { getImgUrl };
