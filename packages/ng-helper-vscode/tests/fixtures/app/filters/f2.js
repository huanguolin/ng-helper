
angular.module('app.filters')
    .filter('f2', function () {
        return function (input) {
            return `${input}`;
        };
    });