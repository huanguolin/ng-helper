namespace app.directives {

    export type DragDropTarget = {
        dragSource: Element;
        dropTo: Element;
    }

    class DragSourceController {
        static $inject = [
            '$scope',
            '$element',
            '$document',
        ];
        constructor(
            private $scope: ng.IScope,
            private $element: ng.IAugmentedJQuery,
            private $document: ng.IDocumentService,
        ) { }
        dragSourceEle: Element | null = null;
        disabledDrag?: boolean;
        dropToEleSelector!: string;
        onDragDrop!: (p: {
            dragDropTarget: DragDropTarget;
        }) => void;
        num!: number;
        fmt!: (s: string, option: { lower: boolean, upper: boolean }) => string;
    }

    angular.module('app.directives').component('dragSource', {
        template : `
        <baz-qux attr-title="bar-foo"></baz-qux>
        <div number-check max="100" ng-modal="ctrl.num | status"></div>
        <div class="drag-source-container" draggable="{{!ctrl.disabledDrag}}" ng-transclude></div>
        <!-- 'ctrl' completion -->
        {{c}}
        <!-- 'ctrl.*' completion -->
        {{ctrl.}}
        <!-- filter completion -->
        <div ng-if="ctrl.num | s"></div>
        <!-- test signature: trigger by ',' -->
        <div>{{ctrl.fmt('xyz',)}}</div>
        `,
        bindings : {
            disabledDrag : '<?',
            dropToEleSelector : '<',
            onDragDrop : '&',
        },
        transclude : true,
        controllerAs : 'ctrl',
        controller : DragSourceController,
    });
}