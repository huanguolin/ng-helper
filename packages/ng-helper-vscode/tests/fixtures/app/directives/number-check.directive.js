'use strict';
angular.module('app.directives').directive('numberCheck', [
    function () {
        return {
            restrict : 'A',
            require : 'ngModel',
            scope : {
                min : '?<',
                max : '?<',
                canNaN : '?<allowNan'
            },
            link : function (scope, element, attrs, ctrl) {
            },
        };
    },
]);