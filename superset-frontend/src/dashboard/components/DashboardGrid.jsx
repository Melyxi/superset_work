/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import ReactFlow, {
  Background,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
} from 'reactflow';
import { debounce } from 'lodash';
import { addAlpha, css, styled, t } from '@superset-ui/core';
import { EmptyStateBig } from 'src/components/EmptyState';
import { componentShape } from '../util/propShapes';
import DashboardComponent from '../containers/DashboardComponent';
import DragDroppable from './dnd/DragDroppable';
import { GRID_GUTTER_SIZE, GRID_COLUMN_COUNT } from '../util/constants';
import { TAB_TYPE } from '../util/componentTypes';
import { deleteComponent } from '../actions/dashboardLayout';

const propTypes = {
  id: PropTypes.string.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool,
  gridComponent: componentShape,
  handleComponentDrop: PropTypes.func.isRequired,
  isComponentVisible: PropTypes.bool.isRequired,
  // resizeComponent: PropTypes.func.isRequired,
  // setDirectPathToChild: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
  dashboardId: PropTypes.number,
};

const nodeTypes = {
  DashboardComponent,
};

const defaultProps = {};

const renderDraggableContentBottom = dropProps =>
  dropProps.dropIndicatorProps && (
    <div className="drop-indicator drop-indicator--bottom" />
  );

const renderDraggableContentTop = dropProps =>
  dropProps.dropIndicatorProps && (
    <div className="drop-indicator drop-indicator--top" />
  );

const DashboardEmptyStateContainer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

const StyledDiv = styled.div`
  flex-direction: column;
  display: flex;
  flex-grow: 1;
  height: 100%;
`;

const GridContent = styled.div`
  ${({ theme }) => css`
    position: relative;
    // display: flex;
    // flex-direction: column;

    /* gutters between rows */
    & > div:not(:last-child):not(.empty-droptarget) {
      margin-bottom: ${theme.gridUnit * 4}px;
    }

    & > .empty-droptarget {
      width: 100%;
      height: 100%;
    }

    & > .empty-droptarget:first-child {
      height: ${theme.gridUnit * 12}px;
      margin-top: ${theme.gridUnit * -6}px;
      margin-bottom: ${theme.gridUnit * -6}px;
    }

    & > .empty-droptarget:only-child {
      height: 80vh;
    }
  `}
`;

const GridColumnGuide = styled.div`
  ${({ theme }) => css`
    // /* Editing guides */
    &.grid-column-guide {
      position: absolute;
      top: 0;
      min-height: 100%;
      background-color: ${addAlpha(
        theme.colors.primary.base,
        // parseFloat(theme.opacity.light) / 100,
        0.05,
      )};
      pointer-events: none;
      box-shadow: inset 0 0 0 1px
        ${addAlpha(
          theme.colors.primary.base,
          // parseFloat(theme.opacity.mediumHeavy) / 100,
          0.15,
        )};
    }
  `};
`;

const EMPTY = [];

const DashboardGrid = forwardRef((props, ref) => {
  const {
    id,
    gridComponent,
    handleComponentDrop,
    dashboardLayoutChange,
    deleteComponent,
    depth,
    width,
    isComponentVisible,
    editMode,
    canEdit,
    setEditMode,
    setDirectPathToChild,
    dashboardId,
  } = props;

  const updateRequired = useRef(true);

  const [nodesState, setNodesState] = useState([]);
  const { project } = useReactFlow();

  useEffect(() => {
    setNodesState(gridComponent?.meta?.layout ?? []);
  }, [gridComponent?.meta?.layout]);

  const debouncedDashboardLayoutChange = useMemo(
    () => debounce(dashboardLayoutChange, 500),
    [dashboardLayoutChange],
  );

  const setNodes = useCallback((nodes) => {
    setNodesState(nodes);
    debouncedDashboardLayoutChange(id, nodes);
  }, [id]);

  const onNodesChange = useCallback((nodeChanges) => {
    setNodesState((nodes) => {
      const newNodes = applyNodeChanges(nodeChanges, nodes);
      debouncedDashboardLayoutChange(id, newNodes);
      return newNodes;
    });
  }, [id]);

  const onNodesDelete = useCallback((nodes) => {
    nodes.forEach((node) => {
      const parents = node.data?.parents ?? [];
      // deleteComponent(node.id, gridComponent?.id ?? parents[parents.length - 1]);
      deleteComponent(node.id, gridComponent?.id);
    });
  }, [gridComponent?.id]);

  const appContainer = document.getElementById('dashboard_background');
  const backgroundImg = appContainer ? appContainer.value : '';

  const handleTopDropTargetDrop = useCallback((dropResult) => {
    if (dropResult) {
      const refBoundingRect = dropResult.Component.ref?.getBoundingClientRect() ?? {
        top: 0,
        left: 0,
      };
      const clientOffset = dropResult.monitor.getClientOffset() ?? { x: 0, y: 0 };

      handleComponentDrop({
        ...dropResult,
        destination: {
          ...dropResult.destination,
          // force appending as the first child if top drop target
          index: 0,
        },
        position: project({
          x: Math.abs(clientOffset.x - refBoundingRect.left),
          y: Math.abs(clientOffset.y - refBoundingRect.top),
        }),
      });
    }
  }, []);

  const handleChangeTab = useCallback(({ pathToTabIndex }) => {
    setDirectPathToChild(pathToTabIndex);
  }, []);

  const renderReactFlow = () => (
    <ReactFlow
      minZoom={1}
      maxZoom={1}
      // fitView
      translateExtent={[[0, 0], [width, Number.POSITIVE_INFINITY]]}
      nodeExtent={[[0, 0], [width, Number.POSITIVE_INFINITY]]}
      nodeTypes={nodeTypes}
      nodes={nodesState}
      setNodes={setNodes}
      onNodesChange={onNodesChange}
      onNodesDelete={onNodesDelete}
      paneMoveable={false}
      panOnScroll={true}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      onlyRenderVisibleElements={false}
      preventScrolling={false}
      selectionMode={SelectionMode.Partial}
      nodesDraggable={editMode}
    >
      {editMode ? <Background /> : null}
    </ReactFlow>
  );

  const shouldDisplayEmptyState = gridComponent?.children?.length === 0;
  const shouldDisplayTopLevelTabEmptyState =
    shouldDisplayEmptyState && gridComponent.type === TAB_TYPE;

  const dashboardEmptyState = editMode && (
    <EmptyStateBig
      title={t('Drag and drop components and charts to the dashboard')}
      description={t(
        'You can create a new chart or use existing ones from the panel on the right',
      )}
      buttonText={
        <>
          <i className="fa fa-plus" />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        window.open(
          `/chart/add?dashboard_id=${dashboardId}`,
          '_blank',
          'noopener noreferrer',
        );
      }}
      image="chart.svg"
    />
  );

  const topLevelTabEmptyState = editMode ? (
    <EmptyStateBig
      title={t('Drag and drop components to this tab')}
      description={t(
        `You can create a new chart or use existing ones from the panel on the right`,
      )}
      buttonText={
        <>
          <i className="fa fa-plus" />
          {t('Create a new chart')}
        </>
      }
      buttonAction={() => {
        window.open(
          `/chart/add?dashboard_id=${dashboardId}`,
          '_blank',
          'noopener noreferrer',
        );
      }}
      image="chart.svg"
    />
  ) : (
    <EmptyStateBig
      title={t('There are no components added to this tab')}
      description={
        canEdit && t('You can add the components in the edit mode.')
      }
      buttonText={canEdit && t('Edit the dashboard')}
      buttonAction={
        canEdit &&
        (() => {
          setEditMode(true);
        })
      }
      image="chart.svg"
    />
  );

  return width < 100 ? null : (
    <>
      {shouldDisplayEmptyState && (
        <DashboardEmptyStateContainer>
          {shouldDisplayTopLevelTabEmptyState
            ? topLevelTabEmptyState
            : dashboardEmptyState}
        </DashboardEmptyStateContainer>
      )}
      <StyledDiv className="dashboard-grid" ref={ref}>
        {editMode ? (
          <DragDroppable
            component={gridComponent}
            depth={depth}
            parentComponent={null}
            index={0}
            orientation="column"
            onDrop={handleTopDropTargetDrop}
            className="empty-droptarget"
            editMode
            style={{ height: '100%' }}
          >
            {renderReactFlow}
          </DragDroppable>
        ) : (
          renderReactFlow()
        )}
      </StyledDiv>
    </>
  );
});

// class DashboardGrid extends React.PureComponent {
//   render() {
//     const {
//       gridComponent,
//       handleComponentDrop,
//       depth,
//       width,
//       isComponentVisible,
//       editMode,
//       canEdit,
//       setEditMode,
//       dashboardId,
//     } = this.props;
//     const columnPlusGutterWidth =
//       (width + GRID_GUTTER_SIZE) / GRID_COLUMN_COUNT;

//     const columnWidth = columnPlusGutterWidth - GRID_GUTTER_SIZE;
//     const { isResizing } = this.state;

//     const shouldDisplayEmptyState = gridComponent?.children?.length === 0;
//     const shouldDisplayTopLevelTabEmptyState =
//       shouldDisplayEmptyState && gridComponent.type === TAB_TYPE;

//     const dashboardEmptyState = editMode && (
//       <EmptyStateBig
//         title={t('Drag and drop components and charts to the dashboard')}
//         description={t(
//           'You can create a new chart or use existing ones from the panel on the right',
//         )}
//         buttonText={
//           <>
//             <i className="fa fa-plus" />
//             {t('Create a new chart')}
//           </>
//         }
//         buttonAction={() => {
//           window.open(
//             `/chart/add?dashboard_id=${dashboardId}`,
//             '_blank',
//             'noopener noreferrer',
//           );
//         }}
//         image="chart.svg"
//       />
//     );

//     const topLevelTabEmptyState = editMode ? (
//       <EmptyStateBig
//         title={t('Drag and drop components to this tab')}
//         description={t(
//           `You can create a new chart or use existing ones from the panel on the right`,
//         )}
//         buttonText={
//           <>
//             <i className="fa fa-plus" />
//             {t('Create a new chart')}
//           </>
//         }
//         buttonAction={() => {
//           window.open(
//             `/chart/add?dashboard_id=${dashboardId}`,
//             '_blank',
//             'noopener noreferrer',
//           );
//         }}
//         image="chart.svg"
//       />
//     ) : (
//       <EmptyStateBig
//         title={t('There are no components added to this tab')}
//         description={
//           canEdit && t('You can add the components in the edit mode.')
//         }
//         buttonText={canEdit && t('Edit the dashboard')}
//         buttonAction={
//           canEdit &&
//           (() => {
//             setEditMode(true);
//           })
//         }
//         image="chart.svg"
//       />
//     );

//     return width < 100 ? null : (
//       <>
//         {shouldDisplayEmptyState && (
//           <DashboardEmptyStateContainer>
//             {shouldDisplayTopLevelTabEmptyState
//               ? topLevelTabEmptyState
//               : dashboardEmptyState}
//           </DashboardEmptyStateContainer>
//         )}
//         <div className="dashboard-grid" ref={this.setGridRef}>
//           <GridContent className="grid-content" data-test="grid-content">
//             {/* make the area above components droppable */}
//             {editMode && (
//               <DragDroppable
//                 component={gridComponent}
//                 depth={depth}
//                 parentComponent={null}
//                 index={0}
//                 orientation="column"
//                 onDrop={this.handleTopDropTargetDrop}
//                 className="empty-droptarget"
//                 editMode
//               >
//                 {renderDraggableContentBottom}
//               </DragDroppable>
//             )}
//             {gridComponent?.children?.map((id, index) => (
//               <DashboardComponent
//                 key={id}
//                 id={id}
//                 parentId={gridComponent.id}
//                 depth={depth + 1}
//                 index={index}
//                 availableColumnCount={GRID_COLUMN_COUNT}
//                 columnWidth={columnWidth}
//                 isComponentVisible={isComponentVisible}
//                 onResizeStart={this.handleResizeStart}
//                 onResize={this.handleResize}
//                 onResizeStop={this.handleResizeStop}
//                 onChangeTab={this.handleChangeTab}
//               />
//             ))}
//             {/* make the area below components droppable */}
//             {editMode && gridComponent?.children?.length > 0 && (
//               <DragDroppable
//                 component={gridComponent}
//                 depth={depth}
//                 parentComponent={null}
//                 index={gridComponent.children.length}
//                 orientation="column"
//                 onDrop={handleComponentDrop}
//                 className="empty-droptarget"
//                 editMode
//               >
//                 {renderDraggableContentTop}
//               </DragDroppable>
//             )}
//             {isResizing &&
//               Array(GRID_COLUMN_COUNT)
//                 .fill(null)
//                 .map((_, i) => (
//                   <GridColumnGuide
//                     key={`grid-column-${i}`}
//                     className="grid-column-guide"
//                     style={{
//                       left: i * GRID_GUTTER_SIZE + i * columnWidth,
//                       width: columnWidth,
//                     }}
//                   />
//                 ))}
//           </GridContent>
//         </div>
//       </>
//     );
//   }
// }

DashboardGrid.propTypes = propTypes;
DashboardGrid.defaultProps = defaultProps;

export default DashboardGrid;
