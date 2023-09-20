import React, { useMemo, useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';

import rison from 'rison';
import moment from 'moment';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import DeleteModal from 'src/components/DeleteModal';
import { Tooltip } from 'src/components/Tooltip';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import SharedImageModal from 'src/features/sharedImages/SharedImageModal';
import { SharedImageObject } from 'src/features/sharedImages/types';

const PAGE_SIZE = 25;

interface SharedImageListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function SharedImageList({
  addDangerToast,
  addSuccessToast,
  user,
}: SharedImageListProps) {
  const {
    state: { loading, resourceCount, resourceCollection, bulkSelectEnabled },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<SharedImageObject>(
    'shared_image',
    t('Shared images'),
    addDangerToast,
  );

  const [sharedImageModalOpen, setSharedImageModalOpen] =
    useState<boolean>(false);
  const [currentSharedImage, setCurrentSharedImage] =
    useState<SharedImageObject | null>(null);

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');

  const [sharedImageCurrentlyDeleting, setSharedImageCurrentlyDeleting] =
    useState<SharedImageObject | null>(null);

  const handleSharedImageDelete = ({ id, image_name }: SharedImageObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/shared_image/${id}`,
    }).then(
      () => {
        refreshData();
        setSharedImageCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', image_name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', image_name, errMsg),
        ),
      ),
    );
  };

  const handleBulkSharedImageDelete = (
    sharedImagesToDelete: SharedImageObject[],
  ) => {
    SupersetClient.delete({
      endpoint: `/api/v1/shared_image/?q=${rison.encode(
        sharedImagesToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t(
            'There was an issue deleting the selected shared image: %s',
            errMsg,
          ),
        ),
      ),
    );
  };

  function handleSharedImageEdit(sharedImage: SharedImageObject) {
    setCurrentSharedImage(sharedImage);
    setSharedImageModalOpen(true);
  }

  const initialSort = [{ id: 'image_name', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'image_name',
        Header: t('Name'),
      },
      {
        accessor: 'description',
        Header: t('Description'),
      },
      {
        accessor: 'width',
        Header: t('Width'),
        size: 'xl',
      },
      {
        accessor: 'height',
        Header: t('Height'),
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => {
          let name = 'null';

          if (changedBy) {
            name = `${changedBy.first_name} ${changedBy.last_name}`;
          }

          return (
            <Tooltip
              id="allow-run-async-header-tooltip"
              title={t('Last modified by %s', name)}
              placement="right"
            >
              <span>{changedOn}</span>
            </Tooltip>
          );
        },
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { created_on: createdOn },
          },
        }: any) => {
          const date = new Date(createdOn);
          const utc = new Date(
            Date.UTC(
              date.getFullYear(),
              date.getMonth(),
              date.getDate(),
              date.getHours(),
              date.getMinutes(),
              date.getSeconds(),
              date.getMilliseconds(),
            ),
          );

          return moment(utc).fromNow();
        },
        Header: t('Created on'),
        accessor: 'created_on',
        size: 'xl',
        disableSortBy: true,
      },
      {
        accessor: 'created_by',
        disableSortBy: true,
        Header: t('Created by'),
        Cell: ({
          row: {
            original: { created_by: createdBy },
          },
        }: any) =>
          createdBy ? `${createdBy.first_name} ${createdBy.last_name}` : '',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleSharedImageEdit(original);
          const handleDelete = () => setSharedImageCurrentlyDeleting(original);

          const actions = [
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit shared image'),
                  placement: 'bottom',
                  icon: 'Edit',
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete shared image'),
                  placement: 'bottom',
                  icon: 'Trash',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canEdit && !canDelete,
        size: 'xl',
      },
    ],
    [canDelete, canCreate],
  );

  const menuData: SubMenuProps = {
    name: t('Shared images'),
  };

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Shared image')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        setCurrentSharedImage(null);
        setSharedImageModalOpen(true);
      },
    });
  }

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  menuData.buttons = subMenuButtons;

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Created by'),
        key: 'created_by',
        id: 'created_by',
        input: 'select',
        operator: FilterOperator.relationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'shared_image',
          'created_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
      },
      {
        Header: t('Search'),
        key: 'search',
        id: 'image_name',
        input: 'search',
        operator: FilterOperator.contains,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu {...menuData} />
      <SharedImageModal
        addDangerToast={addDangerToast}
        sharedImage={currentSharedImage}
        onSharedImageAdd={() => refreshData()}
        onHide={() => setSharedImageModalOpen(false)}
        show={sharedImageModalOpen}
      />
      {sharedImageCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete the shared image.',
          )}
          onConfirm={() => {
            if (sharedImageCurrentlyDeleting) {
              handleSharedImageDelete(sharedImageCurrentlyDeleting);
            }
          }}
          onHide={() => setSharedImageCurrentlyDeleting(null)}
          open
          title={t('Delete shared image?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected shared images?',
        )}
        onConfirm={handleBulkSharedImageDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = canDelete
            ? [
                {
                  key: 'delete',
                  name: t('Delete'),
                  onSelect: confirmDelete,
                  type: 'danger',
                },
              ]
            : [];

          return (
            <ListView<SharedImageObject>
              className="shared-images-list-view"
              columns={columns}
              count={resourceCount}
              data={resourceCollection}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(SharedImageList);
