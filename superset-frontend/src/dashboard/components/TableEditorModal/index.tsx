import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from 'src/components/Modal/Modal';
import Button from 'src/components/Button';
import { SupersetClient, SupersetTheme, css, styled, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { Input } from 'src/components/Input';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import withToasts from 'src/components/MessageToasts/withToasts';
import { AntdForm, Col, Row, Typography } from 'src/components';
import { FormItem } from 'src/components/Form';
import Collapse from 'src/components/Collapse';
import Icons from 'src/components/Icons';
import { Slice } from 'src/dashboard/types';
import { Tooltip } from 'src/components/Tooltip';
import ChangeColumnsConfirmModal from './ChangeColumnsConfirmModal';

interface ColumnDefinition {
  name: string;
  type: string;
  description?: string;
}

interface TableEditorColumnsProps {
  tableId: number;
  name?: string;
  description?: string;
  columns: ColumnDefinition[];
  placeholderData?: Record<string, any>;
  onChangeTable?: () => void | Promise<void>;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
}

function getInitialValues(columns: ColumnDefinition[]): Record<string, any> {
  return columns.reduce<Record<string, any>>((acc, { name }) => {
    acc[name] = '';
    return acc;
  }, {});
}

const TableEditorColumnsRoot = styled.div`
  display: flex;
  flex-direction: column;
`;

const TableEditorColumnsActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-top: 16px;
`;

const TableEditorColumnsForm = styled(AntdForm)`
  max-height: 500px;
  overflow-x: hidden;
  overflow-y: auto;
`;

const StyledFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

// TODO: сделать обработку разных типов колонок, или функциями или отдельными компонентами.
const TableEditorColumns = withToasts((props: TableEditorColumnsProps) => {
  const {
    tableId,
    columns,
    placeholderData = {},
    onChangeTable,
    addSuccessToast,
    addDangerToast,
  } = props;

  const [form] = AntdForm.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const initialValues = useMemo(() => getInitialValues(columns), [columns]);

  const columnsMap = useMemo(
    () =>
      columns.reduce<Record<string, ColumnDefinition>>((acc, col) => {
        acc[col.name] = col;
        return acc;
      }, {}),
    [columns],
  );

  const onFinish = (values: Record<string, any>) => {
    setIsLoading(true);

    const data = Object.entries(values).reduce<Record<string, any>>(
      (acc, [key, val]) => {
        acc[key] = val === '' ? null : val;

        const { type } = columnsMap[key];

        if (
          acc[key] !== null &&
          (type === 'INTEGER' || type === 'DOUBLE PRECISION')
        ) {
          acc[key] = Number(acc[key]);
        }

        return acc;
      },
      {},
    );

    SupersetClient.post({
      endpoint: '/editortablesview/editor_table_insert/',
      jsonPayload: { id_table: tableId, data },
    })
      .then(
        () => {
          form.resetFields();
          onChangeTable?.();
          addSuccessToast('Success');
        },
        async response => {
          const { error, statusText, message } = await getClientErrorObject(
            response,
          );
          let errorText = error || statusText || t('An error has occurred');
          if (typeof message === 'object' && 'json_metadata' in message) {
            errorText = (message as { json_metadata: string }).json_metadata;
          } else if (typeof message === 'string') {
            errorText = message;
          }

          addDangerToast(errorText);
        },
      )
      .finally(() => {
        setIsLoading(false);
      });
  };

  const touchedValues = Object.entries(
    form.getFieldsValue(true, ({ touched }) => touched),
  ).map(([key, value]) => ({
    ...columnsMap[key],
    value,
  }));

  return (
    <>
      <TableEditorColumnsRoot>
        <TableEditorColumnsForm
          form={form}
          onFinish={onFinish}
          layout="vertical"
          initialValues={initialValues}
        >
          <Row
            gutter={16}
            css={(theme: SupersetTheme) => css`
              position: sticky;
              top: 0;
              z-index: 1;
              padding-bottom: 8px;
              background-color: ${theme.colors.grayscale.light5};
            `}
          >
            <Col span={5}>
              <Typography.Text strong>Колонка</Typography.Text>
            </Col>
            <Col span={9}>
              <Typography.Text strong>Предыдущее значение</Typography.Text>
            </Col>
            <Col span={1} />
            <Col span={9}>
              <Typography.Text strong>Новое значение</Typography.Text>
            </Col>
          </Row>
          {columns.map(({ name, type, description }) => {
            const inputType = {
              DATE: 'date',
              DATETIME: 'datetime-local',
              TIMESTAMP: 'datetime-local',
              TIME: 'time',
            }[type];

            const substringDateTimeValue = (dateTimeString: string) => {
              switch (inputType) {
                case 'date':
                  return dateTimeString.substring(0, 10);
                case 'time':
                  return dateTimeString.substring(11, 19);
                case 'datetime-local':
                default:
                  return dateTimeString.substring(0, 19);
              }
            };

            const handleDateNowButtonClick = () => {
              form.setFieldsValue({
                [name]: substringDateTimeValue(new Date().toISOString()),
              });
            };

            const handleCurrentValueButtonClick = () => {
              form.setFieldsValue({
                [name]: placeholderData[name],
              });
            };

            return (
              <Row
                gutter={16}
                css={css`
                  margin-bottom: 8px;
                `}
              >
                <Col span={5}>
                  <Tooltip title={name} placement="top">
                    <Typography.Text>{description || name}</Typography.Text>
                  </Tooltip>
                </Col>
                <Col span={9}>
                  <Input
                    type={inputType}
                    disabled
                    value={
                      ['date', 'time', 'datetime-local'].includes(
                        inputType as string,
                      )
                        ? substringDateTimeValue(placeholderData[name])
                        : placeholderData[name]
                    }
                  />
                </Col>
                <Col span={1}>
                  {['date', 'time', 'datetime-local'].includes(
                    inputType as string,
                  ) ? (
                    <Tooltip title="Текущее время" placement="top">
                      <Button
                        buttonStyle="link"
                        onClick={handleDateNowButtonClick}
                        css={css`
                          padding: 0;
                        `}
                      >
                        <Icons.ClockCircleOutlined iconSize="l" />
                      </Button>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Test" placement="top">
                      <Button
                        buttonStyle="link"
                        onClick={handleCurrentValueButtonClick}
                        css={css`
                          padding: 0;
                        `}
                      >
                        <Icons.DoubleRightOutlined iconSize="l" />
                      </Button>
                    </Tooltip>
                  )}
                </Col>
                <Col span={9}>
                  <StyledFormItem name={name}>
                    <Input autoComplete="off" type={inputType} name={name} />
                  </StyledFormItem>
                </Col>
              </Row>
            );
          })}
        </TableEditorColumnsForm>
        <TableEditorColumnsActions>
          <Button
            key="submit"
            buttonStyle="primary"
            onClick={() => {
              setIsConfirmModalOpen(true);
            }}
            loading={isLoading}
          >
            {t('Save')}
          </Button>
        </TableEditorColumnsActions>
      </TableEditorColumnsRoot>
      <ChangeColumnsConfirmModal
        show={isConfirmModalOpen}
        onConfirm={() => {
          setIsConfirmModalOpen(false);
          form.submit();
        }}
        onCancel={() => {
          setIsConfirmModalOpen(false);
        }}
        columns={touchedValues}
      />
    </>
  );
});

type FetchTableJson = {
  id_table: number;
  name?: string;
  description?: string;
  columns: {
    name: string;
    description?: string;
    type: string;
    longType: string;
    comment?: string | null;
  }[];
  table_data?: Record<string, any>;
}[];

type Tables = Omit<
  TableEditorColumnsProps,
  'addDangerToast' | 'addSuccessToast'
>[];

type TableEditorSliceProps = Slice;

const TableEditorSlice = ({ slice_id }: TableEditorSliceProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<Tables>([]);
  const [activePanels, setActivePanels] = useState<string[]>([]);

  function handleActivePanelChange(panels: string | string[]) {
    if (typeof panels === 'string') {
      setActivePanels([panels]);
    } else {
      setActivePanels(panels);
    }
  }

  const fetchTable = useCallback(
    async ({
      sliceId,
      onSuccess,
    }: {
      sliceId: number;
      onSuccess?: (tables: Tables) => void | Promise<void>;
    }) => {
      try {
        setIsLoading(true);
        const response = await SupersetClient.get({
          endpoint: `/editortablesview/editor_table/${sliceId}/`,
        });

        const newTables: Tables = (
          (response?.json as FetchTableJson) ?? []
        ).map(({ id_table, columns, table_data, name, description }) => ({
          tableId: id_table,
          name,
          description,
          columns: columns.map(({ name, type, description }) => ({
            name,
            type,
            description,
          })),
          placeholderData: table_data,
        }));

        setTables(newTables);

        await onSuccess?.(newTables);
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchTable({
      sliceId: slice_id,
      onSuccess: newTables => {
        setActivePanels(newTables.map(({ tableId }) => String(tableId)));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice_id]);

  const handleChangeTable = async () => {
    await fetchTable({
      sliceId: slice_id,
    });
  };

  return (
    <div>
      {isLoading && tables.length === 0 ? (
        <div css={{ position: 'relative', minHeight: '50px' }}>
          <Loading />
        </div>
      ) : (
        <Collapse activeKey={activePanels} onChange={handleActivePanelChange}>
          {tables.map((item, index) => (
            <Collapse.Panel
              key={item.tableId}
              header={
                item.name || item.description ? (
                  <Tooltip title={item.name} placement="top">
                    <Typography.Text>
                      {item.description || item.name}
                    </Typography.Text>
                  </Tooltip>
                ) : (
                  <Typography.Text type="secondary">Не задано</Typography.Text>
                )
              }
            >
              <TableEditorColumns
                key={index}
                onChangeTable={handleChangeTable}
                {...item}
              />
            </Collapse.Panel>
          ))}
        </Collapse>
      )}
    </div>
  );
};

export interface TableEditorModalProps {
  slices: { [id: number]: Slice };
  show?: boolean;
  onHide?: () => void;
}

const TableEditorModal = ({
  slices,
  show = false,
  onHide = () => {},
}: TableEditorModalProps) => {
  const [activePanels, setActivePanels] = useState<string[]>(
    Object.keys(slices),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setActivePanels(Object.keys(slices)), [slices]);

  function handleActivePanelChange(panels: string | string[]) {
    if (typeof panels === 'string') {
      setActivePanels([panels]);
    } else {
      setActivePanels(panels);
    }
  }

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Table Editor')}
      centered
      responsive
      footer={false}
      hideFooter
      css={css`
        .ant-modal-body {
          display: flex;
          flex-direction: column;
          & > * + * {
            margin-top: 16px;
          }
        }
      `}
    >
      <Collapse activeKey={activePanels} onChange={handleActivePanelChange}>
        {Object.values(slices).map(slice => (
          <Collapse.Panel
            key={slice.slice_id}
            header={
              slice.slice_name ? (
                <Typography.Text strong>{slice.slice_name}</Typography.Text>
              ) : (
                <Typography.Text strong type="secondary">
                  Не задано
                </Typography.Text>
              )
            }
          >
            <TableEditorSlice key={slice.slice_id} {...slice} />
          </Collapse.Panel>
        ))}
      </Collapse>
    </Modal>
  );
};

export default TableEditorModal;
