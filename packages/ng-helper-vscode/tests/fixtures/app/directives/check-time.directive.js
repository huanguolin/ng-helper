'use strict';
angular.module('app.directives').directive('checkTime', [
    function () {
        return {
            restrict : 'A',
            require : 'ngModel',
            scope : {
                min : '?<',
                max : '?<',
                info : '@?'
            },
            template: ``,
            link : function (scope, element, attrs, ctrl) {
            },
        };
    },
]);