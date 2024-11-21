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
            template: `
<!-- test semantic -->
<section>
    <!-- component -->
    <bar-foo bar="1 + 9" foo="text"></bar-foo>
    <best-xyz x="some text" y="value"></best-xyz>
    <!-- directive -->
    <div best-xyz x="hi" y="value"></div>
</section>
            `,
            link : function (scope, element, attrs, ctrl) {
            },
        };
    },
]);