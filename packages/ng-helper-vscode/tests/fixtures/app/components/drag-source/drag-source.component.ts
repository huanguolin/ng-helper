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
    }

    angular.module('app.directives').component('dragSource', {
        template : `
        <baz-qux attr-title="bar-foo"></baz-qux>
        <div number-check max="100" ng-modal="ctrl.num"></div>
        <div class="drag-source-container" draggable="{{!ctrl.disabledDrag}}" ng-transclude></div>
        <!-- 'ctrl' completion -->
        {{   }}
        <!-- 'ctrl.*' completion -->
        {{ctrl.}}
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