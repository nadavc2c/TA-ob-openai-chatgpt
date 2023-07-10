import Immutable from "immutable";
class tableMemory {
    constructor() {
        this._Data = Immutable.fromJS([]);
        this._output = Immutable.fromJS([]);
        this._totalPage;
        this._currentPage = 0;
        this._prePage = 10;
        this._rowsPerPage = 10;
        this._isCheckboxHidden = true;
        this._deleteCandidate = new Set();
        this._sortKey = "";
        this._isLoading = {
            status: false,
            loadingText: ""
        };
    }
}

export default tableMemory;
