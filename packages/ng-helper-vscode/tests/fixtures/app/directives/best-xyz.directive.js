'use strict';
angular.module('app.directives').directive('bestXyz', [
    function () {
        return {
            restrict : 'AE',
            scope : {
                x : '?@',
                y : '?<',
                z : '?&',
                xyz : '?=all',
            },
            template: `
<!-- component name completion -->
    
<!-- component attr completion -->
<bar-foo  ></bar-foo>
<!-- directive name completion -->
<div  b ></div>
<!-- directive attr completion -->
<div best-xyz   ></div>
<!-- ng-* completion -->
<div  n ></div>
            `,
            link : function (scope, element, attrs, ctrl) {
            },
        };
    },
]);