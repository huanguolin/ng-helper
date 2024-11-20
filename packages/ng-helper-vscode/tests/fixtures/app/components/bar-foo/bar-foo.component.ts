
namespace app.components {

    class BarFooController {
        static $inject = ['$scope'];

        constructor(
            private $scope: ng.IScope,
        ) {
        }

        bar!: number;
        foo!: string;
        disabled?: boolean;
    }

    angular.module('myApp.components').component('barFoo', {
        templateUrl : 'app/components/bar-foo/bar-foo.component.html',
        bindings : {
            bar : '<',
            foo : '@',
            disabled : '?<attrDisabled'
        },
        controllerAs : 'ctrl',
        controller : BarFooController,
    });
}