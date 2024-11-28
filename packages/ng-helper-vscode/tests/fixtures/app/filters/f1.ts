namespace app.filters {
    export enum Status {
        commit,
        pending,
        approved,
    }

    angular.module('app.filters')
        .filter('status', ['$translate',
            function ($translate: ng.translate.ITranslateService) {
                return function (input: Status, step: number): string {
                    return `${input}(${step})`;
                };
            },
        ])
        .filter('f1', ['$translate',
            function ($translate: ng.translate.ITranslateService) {
                return function (input: number): string {
                    return `${input}`;
                };
            },
        ]);
}