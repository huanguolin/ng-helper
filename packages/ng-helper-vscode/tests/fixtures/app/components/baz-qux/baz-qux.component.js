
class BazQuxController {
    static $inject = ['$scope'];

    constructor(
        $scope,
    ) {
        this.baz = 100;
        this.title = 'some title'; // default value
    }
}

angular.module('myApp.components').component('bazQux', {
    templateUrl: 'app/components/baz-qux/baz-qux.component.html',
    bindings: {
        baz: '<',
        qux: '&?',
        title : '?@attrTitle'
    },
    controllerAs: 'ctrl',
    controller: BazQuxController,
});