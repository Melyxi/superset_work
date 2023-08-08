import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from 'src/components/Modal/Modal';
import Button from 'src/components/Button';
import { SupersetClient, css, styled, t } from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { Input } from 'src/components/Input';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import withToasts from 'src/components/MessageToasts/withToasts';
import { AntdForm, Col, Row, Typography } from 'src/components';
import { FormItem } from 'src/components/Form';
import Collapse from 'src/components/Collapse';

interface ColumnDefinition {
  header: string;
  type: string;
}

interface TableEditorColumnsProps {
  tableId: number;
  tableName?: string;
  columns: ColumnDefinition[];
  placeholderData?: Record<string, any>;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
}

function getInitialValues(columns: ColumnDefinition[]): Record<string, any> {
  return columns.reduce<Record<string, any>>((acc, { header }) => {
    acc[header] = '';
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
    addSuccessToast,
    addDangerToast,
  } = props;

  const [form] = AntdForm.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const initialValues = useMemo(() => getInitialValues(columns), [columns]);

  const onFinish = (values: Record<string, any>) => {
    setIsLoading(true);

    const types = columns.reduce<Record<string, string>>((acc, col) => {
      acc[col.header] = col.type;
      return acc;
    }, {});

    const data = Object.entries(values).reduce<Record<string, any>>(
      (acc, [key, val]) => {
        acc[key] = val === '' ? null : val;

        if (
          acc[key] !== null &&
          (types[key] === 'INTEGER' || types[key] === 'DOUBLE PRECISION')
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

  return (
    <TableEditorColumnsRoot>
      <TableEditorColumnsForm
        form={form}
        onFinish={onFinish}
        layout="vertical"
        initialValues={initialValues}
      >
        <Row
          gutter={16}
          css={css`
            position: sticky;
            top: 0;
            z-index: 1;
            padding-bottom: 8px;
          `}
        >
          <Col span={6}>
            <Typography.Text strong>Колонка</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong>Предыдущее значение</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong>Новое значение</Typography.Text>
          </Col>
        </Row>
        {columns.map(({ header, type }) => {
          const inputType = {
            INTEGER: 'number',
            'DOUBLE PRECISION': 'number',
            VARCHAR: 'text',
          }[type];

          return (
            <Row
              gutter={16}
              css={css`
                margin-bottom: 8px;
              `}
            >
              <Col span={6}>{header}</Col>
              <Col span={9}>
                <Input
                  type={inputType}
                  disabled
                  value={placeholderData[header]}
                />
              </Col>
              <Col span={9}>
                <StyledFormItem name={header}>
                  <Input type={inputType} name={header} />
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
          onClick={form.submit}
          loading={isLoading}
        >
          {t('Save')}
        </Button>
      </TableEditorColumnsActions>
    </TableEditorColumnsRoot>
  );
});

type FetchTableJson = {
  id_table: number;
  name?: string;
  columns: {
    name: string;
    type: string;
    longType: string;
    comment?: string | null;
  }[];
  table_data?: Record<string, any>;
}[];

export interface TableEditorModalProps {
  sliceId: number;
  show?: boolean;
  onHide?: () => void;
}

const TableEditorModal = ({
  sliceId,
  show = false,
  onHide = () => {},
}: TableEditorModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<
    Omit<TableEditorColumnsProps, 'addDangerToast' | 'addSuccessToast'>[]
  >([]);

  const getDefaultActivePanel = () =>
    tables.map(({ tableId }) => String(tableId));

  const [activePanels, setActivePanels] = useState<string[]>(
    getDefaultActivePanel,
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setActivePanels(getDefaultActivePanel()), [tables]);

  function handleActivePanelChange(panels: string | string[]) {
    if (typeof panels === 'string') {
      setActivePanels([panels]);
    } else {
      setActivePanels(panels);
    }
  }

  const fetchTable = useCallback(() => {
    setIsLoading(true);
    SupersetClient.get({
      endpoint: `/editortablesview/editor_table/${sliceId}/`,
    })
      .then(response => {
        setTables(
          ((response?.json as FetchTableJson) ?? []).map(
            ({ id_table, columns, table_data, name }) => ({
              tableId: id_table,
              tableName: name,
              columns: columns.map(({ name, type }) => ({
                header: name as string,
                type,
              })),
              placeholderData: table_data,
            }),
          ),
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [sliceId]);

  useEffect(() => {
    if (show) {
      fetchTable();
    }
  }, [show, fetchTable]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Table Editor')}
      centered
      responsive
      footer={false}
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
      {isLoading ? (
        <div css={{ position: 'relative', minHeight: '50px' }}>
          <Loading />
        </div>
      ) : (
        <Collapse
          defaultActiveKey={activePanels}
          onChange={handleActivePanelChange}
        >
          {tables.map((item, index) => (
            <Collapse.Panel
              key={item.tableId}
              header={
                item.tableName ? (
                  <Typography.Text>{item.tableName}</Typography.Text>
                ) : (
                  <Typography.Text type="secondary">Не задано</Typography.Text>
                )
              }
            >
              <TableEditorColumns key={index} {...item} />
            </Collapse.Panel>
          ))}
        </Collapse>
      )}
    </Modal>
  );
};

export default TableEditorModal;
