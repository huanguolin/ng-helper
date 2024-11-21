
angular.module('app.components').component('commonPanel', {
    templateUrl : 'app/components/common-panel/common-panel.component.html',
    bindings : {
        title : '@?attrTitle',
        bodyNoPadding : '<?',
    },
    transclude : {
        title : '?panelTitle',
        toolbar : '?panelToolbar',
        body : 'panelBody',
    },
    controllerAs : 'ctrl',
});