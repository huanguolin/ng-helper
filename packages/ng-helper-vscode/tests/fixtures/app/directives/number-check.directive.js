'use strict';
angular.module('myApp.directives').directive('numberCheck', [
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