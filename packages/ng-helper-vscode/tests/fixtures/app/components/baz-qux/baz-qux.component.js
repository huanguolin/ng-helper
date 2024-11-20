
class BazQuxController {
    static $inject = ['$scope'];

    constructor(
        $scope,
    ) {
        this.baz = 100;
        this.qux = 'qux';
    }
}

angular.module('myApp.components').component('bazQux', {
    templateUrl: 'app/components/baz-qux/baz-qux.component.html',
    bindings: {
        baz: '<',
        qux: '@',
    },
    controllerAs: 'ctrl',
    controller: BazQuxController,
});