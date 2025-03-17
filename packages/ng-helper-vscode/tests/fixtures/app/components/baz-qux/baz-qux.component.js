
class BazQuxController {
    static $inject = ['$scope'];

    constructor(
        $scope,
    ) {
        this.baz = 100;
        this.title = 'some title'; // default value
        this.obj = {
            txt: 'txt string',
            arr: [
                { id: 1, name: 'item-1' },
                { id: 3, name: 'item-2' },
                { id: 5, name: 'item-3' },
            ],
        };
    }
}

angular.module('app.components').component('bazQux', {
    templateUrl: 'app/components/baz-qux/baz-qux.component.html',
    bindings: {
        baz: '<',
        qux: '&?',
        title : '?@attrTitle'
    },
    controllerAs: 'ctrl',
    controller: BazQuxController,
});