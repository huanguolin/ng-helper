namespace app.pages {
    class P1Controller {
        static $inject = ['$scope', '$translate'];
        constructor(
            private $scope: ng.IScope,
            private $translate: ng.translate.ITranslateService,
        ) {
        }

        title = 'p1 title';
        obj = {
            txt: 'txt string',
            arr: [
                { id: 1, name: 'item-1' },
                { id: 3, name: 'item-2' },
                { id: 5, name: 'item-3' },
            ],
        };
    }

    angular.module('app.pages').controller('P1Controller', P1Controller);
}