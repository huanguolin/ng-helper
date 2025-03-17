
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

        obj = {
            txt: 'txt string',
            arr: [
                { id: 1, name: 'item-1' },
                { id: 3, name: 'item-2' },
                { id: 5, name: 'item-3' },
            ],
        };
    }

    angular.module('app.components').component('barFoo', {
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