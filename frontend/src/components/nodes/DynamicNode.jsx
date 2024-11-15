import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Handle, useHandleConnections } from '@xyflow/react';
import { useSelector, useDispatch } from 'react-redux';
import BaseNode from './BaseNode';
import styles from './DynamicNode.module.css';
import { Input } from '@nextui-org/react';
import {
  updateNodeData,
  updateEdgesOnHandleRename,
} from '../../store/flowSlice';

const DynamicNode = ({ id, type, data, position, ...props }) => {
  const nodeRef = useRef(null);
  const [nodeWidth, setNodeWidth] = useState('auto');
  const [editingField, setEditingField] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const node = useSelector((state) => state.flow.nodes.find((n) => n.id === id));
  const nodeData = data || (node && node.data);
  const dispatch = useDispatch();

  const edges = useSelector((state) => state.flow.edges);

  const handleSchemaKeyEdit = useCallback(
    (oldKey, newKey, schemaType) => {
      if (oldKey === newKey || !newKey.trim()) {
        setEditingField(null);
        return;
      }

      const updatedSchema = {
        ...nodeData?.config?.[`${schemaType}_schema`],
        [newKey]: nodeData?.config?.[`${schemaType}_schema`][oldKey],
      };
      delete updatedSchema[oldKey];
      dispatch(
        updateNodeData({
          id,
          data: {
            config: {
              ...nodeData?.config,
              [`${schemaType}_schema`]: updatedSchema,
            },
          },
        })
      );
      dispatch(
        updateEdgesOnHandleRename({
          nodeId: id,
          oldHandleId: oldKey,
          newHandleId: newKey,
          schemaType,
        })
      );
      setEditingField(null);
    },
    [dispatch, id, nodeData]
  );

  useEffect(() => {
    if (!nodeRef.current || !nodeData) return;

    const inputSchema = nodeData?.config?.input_schema || {};
    const outputSchema = nodeData?.config?.output_schema || {};

    const inputLabels = Object.keys(inputSchema);
    const outputLabels = Object.keys(outputSchema);

    const maxLabelLength = Math.max(
      ...inputLabels.map((label) => label.length),
      ...outputLabels.map((label) => label.length),
      (nodeData?.title || '').length / 1.5
    );

    const calculatedWidth = Math.max(300, maxLabelLength * 15);
    const finalWidth = Math.min(calculatedWidth, 600);

    setNodeWidth(`${finalWidth}px`);
  }, [nodeData]);

  const InputHandleRow = ({ keyName }) => {
    const connections = useHandleConnections({ type: 'target', id: keyName });

    return (
      <tr key={keyName}>
        <td className={styles.handleCell}>
          <Handle
            type="target"
            position="left"
            id={keyName}
            className={`${styles.handle} ${styles.handleLeft} ${
              isCollapsed ? styles.collapsedHandleInput : ''
            }`}
            isConnectable={!isCollapsed && connections.length === 0}
          />
        </td>
        {!isCollapsed && (
          <td className="text-left align-middle">
            {editingField === keyName ? (
              <Input
                autoFocus
                defaultValue={keyName}
                size="sm"
                variant="faded"
                radius="lg"
                onBlur={(e) => handleSchemaKeyEdit(keyName, e.target.value, 'input')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSchemaKeyEdit(keyName, e.target.value, 'input');
                  } else if (e.key === 'Escape') {
                    setEditingField(null);
                  }
                }}
                classNames={{
                  input: 'bg-default-100',
                  inputWrapper: 'shadow-none',
                }}
              />
            ) : (
              <span
                className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary`}
                onClick={() => setEditingField(keyName)}
              >
                {keyName}
              </span>
            )}
          </td>
        )}
      </tr>
    );
  };

  const OutputHandleRow = ({ keyName }) => {
    const connections = useHandleConnections({ type: 'source', id: keyName });

    return (
      <tr key={`output-${keyName}`} className="align-middle">
        {!isCollapsed && (
          <td className="text-right align-middle">
            {editingField === keyName ? (
              <Input
                autoFocus
                defaultValue={keyName}
                size="sm"
                variant="faded"
                radius="lg"
                onBlur={(e) => handleSchemaKeyEdit(keyName, e.target.value, 'output')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSchemaKeyEdit(keyName, e.target.value, 'output');
                  } else if (e.key === 'Escape') {
                    setEditingField(null);
                  }
                }}
                classNames={{
                  input: 'bg-default-100',
                  inputWrapper: 'shadow-none',
                }}
              />
            ) : (
              <span
                className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary`}
                onClick={() => setEditingField(keyName)}
              >
                {keyName}
              </span>
            )}
          </td>
        )}
        <td className={`${styles.handleCell} ${styles.outputHandleCell}`}>
          <div className={styles.handleWrapper}>
            <Handle
              type="source"
              position="right"
              id={keyName}
              className={`${styles.handle} ${styles.handleRight} ${
                isCollapsed ? styles.collapsedHandleOutput : ''
              }`}
              isConnectable={!isCollapsed}
            />
          </div>
        </td>
      </tr>
    );
  };

  const renderHandles = () => {
    if (!nodeData) return null;

    const inputSchema = nodeData?.config?.input_schema || {};
    const outputSchema = nodeData?.config?.output_schema || {};

    const inputs = Object.keys(inputSchema).length;
    const outputs = Object.keys(outputSchema).length;

    return (
      <div className={styles.handlesWrapper} id="handles">
        {/* Input Handles */}
        <div className={styles.handlesColumn}>
          {inputs > 0 && (
            <table style={{ width: '100%' }}>
              <tbody>
                {Object.keys(inputSchema).map((key) => (
                  <InputHandleRow key={key} keyName={key} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Output Handles */}
        <div className={styles.handlesColumn}>
          {outputs > 0 && (
            <table style={{ width: '100%' }}>
              <tbody>
                {Object.keys(outputSchema).map((key) => (
                  <OutputHandleRow key={key} keyName={key} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const isConditionalNode = type === 'ConditionalNode';

  return (
    <div className={styles.dynamicNodeWrapper} style={{ zIndex: props.parentNode ? 1 : 0 }}>
      <BaseNode
        id={id}
        data={nodeData}
        style={{ width: nodeWidth, backgroundColor: isConditionalNode ? '#e0f7fa' : undefined }}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        selected={props.selected}
      >
        <div className={styles.nodeWrapper} ref={nodeRef}>
          {isConditionalNode ? (
            <div>
              <strong>Conditional Node</strong>
            </div>
          ) : null}
          {renderHandles()}
        </div>
      </BaseNode>
    </div>
  );
};

export default DynamicNode;
