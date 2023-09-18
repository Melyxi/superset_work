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
import BackgroundTemplateModal from 'src/features/backgroundTemplates/BackgroundTemplateModal';
import { TemplateObject } from 'src/features/backgroundTemplates/types';

const PAGE_SIZE = 25;

interface BackgroundTemplatesListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function BackgroundTemplatesList({
  addDangerToast,
  addSuccessToast,
  user,
}: BackgroundTemplatesListProps) {
  const {
    state: {
      loading,
      resourceCount: templatesCount,
      resourceCollection: templates,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<TemplateObject>(
    'background_template',
    t('Background templates'),
    addDangerToast,
  );

  const [backgroundTemplateModalOpen, setBackgroundTemplateModalOpen] =
    useState<boolean>(false);
  const [currentBackgroundTemplate, setCurrentBackgroundTemplate] =
    useState<TemplateObject | null>(null);

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');

  const [templateCurrentlyDeleting, setTemplateCurrentlyDeleting] =
    useState<TemplateObject | null>(null);

  const handleTemplateDelete = ({ id, background_name }: TemplateObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/background_template/${id}`,
    }).then(
      () => {
        refreshData();
        setTemplateCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', background_name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', background_name, errMsg),
        ),
      ),
    );
  };

  const handleBulkTemplateDelete = (templatesToDelete: TemplateObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/background_template/?q=${rison.encode(
        templatesToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected templates: %s', errMsg),
        ),
      ),
    );
  };

  function handleBackgroundTemplateEdit(backgroundTemplate: TemplateObject) {
    setCurrentBackgroundTemplate(backgroundTemplate);
    setBackgroundTemplateModalOpen(true);
  }

  const initialSort = [{ id: 'background_name', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'background_name',
        Header: t('Name'),
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
          const handleEdit = () => handleBackgroundTemplateEdit(original);
          const handleDelete = () => setTemplateCurrentlyDeleting(original);

          const actions = [
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit template'),
                  placement: 'bottom',
                  icon: 'Edit',
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete template'),
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
    name: t('Background templates'),
  };

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Background template')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        setCurrentBackgroundTemplate(null);
        setBackgroundTemplateModalOpen(true);
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
          'background_template',
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
        id: 'background_name',
        input: 'search',
        operator: FilterOperator.contains,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu {...menuData} />
      <BackgroundTemplateModal
        addDangerToast={addDangerToast}
        backgroundTemplate={currentBackgroundTemplate}
        onBackgroundTemplateAdd={() => refreshData()}
        onHide={() => setBackgroundTemplateModalOpen(false)}
        show={backgroundTemplateModalOpen}
      />
      {templateCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the template.')}
          onConfirm={() => {
            if (templateCurrentlyDeleting) {
              handleTemplateDelete(templateCurrentlyDeleting);
            }
          }}
          onHide={() => setTemplateCurrentlyDeleting(null)}
          open
          title={t('Delete Template?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected templates?',
        )}
        onConfirm={handleBulkTemplateDelete}
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
            <ListView<TemplateObject>
              className="background-templates-list-view"
              columns={columns}
              count={templatesCount}
              data={templates}
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

export default withToasts(BackgroundTemplatesList);
