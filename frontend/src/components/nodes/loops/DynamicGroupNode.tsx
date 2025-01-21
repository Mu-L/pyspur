import { memo, useState, useRef, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    NodeProps,
    NodeToolbar,
    useReactFlow,
    useStore,
    useStoreApi,
    NodeResizer,
    Handle,
    Position,
    useHandleConnections,
    useConnection,
    useUpdateNodeInternals,
} from '@xyflow/react'
import { Card, CardHeader, CardBody, Button, Input, Alert, Divider } from '@nextui-org/react'
import isEqual from 'lodash/isEqual'

import useDetachNodes from './useDetachNodes'
import { getRelativeNodesBounds } from './groupNodeUtils'
import { RootState } from '@/store/store'
import { getNodeTitle } from '@/utils/flowUtils'
import { updateNodeTitle } from '@/store/flowSlice'
import styles from '../DynamicNode.module.css'

const staticStyles = {
    targetHandle: {
        top: '50%',
        left: 0,
        width: '30%',
        height: '100%',
        zIndex: 10,
        opacity: 0,
        pointerEvents: 'auto' as const,
    },
}
const resizerLineStyle = { borderColor: 'rgb(148 163 184)' } // Tailwind slate-400
const resizerHandleStyle = {
    backgroundColor: 'white',
    width: 8,
    height: 8,
    borderRadius: 2,
    border: '1.5px solid rgb(148 163 184)', // Tailwind slate-400
}

export interface DynamicGroupNodeProps {
    id: string
}

const convertToPythonVariableName = (str: string): string => {
    if (!str) return ''
    str = str.replace(/[\s-]/g, '_')
    str = str.replace(/[^a-zA-Z0-9_]/g, '')
    if (/^[0-9]/.test(str)) {
        str = '_' + str
    }
    return str
}

const DynamicGroupNode: React.FC<DynamicGroupNodeProps> = ({ id }) => {
    const dispatch = useDispatch()
    const [editingTitle, setEditingTitle] = useState(false)
    const [titleInputValue, setTitleInputValue] = useState('')
    const [showTitleError, setShowTitleError] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(false)

    const store = useStoreApi()
    const { deleteElements } = useReactFlow()
    const detachNodes = useDetachNodes()

    const node = useSelector((state: RootState) => state.flow.nodes.find((n) => n.id === id))
    const nodes = useSelector((state: RootState) => state.flow.nodes)
    const nodeConfig = useSelector((state: RootState) => state.flow.nodeConfigs[id])

    const { minWidth, minHeight, hasChildNodes } = useStore((store) => {
        const childNodes = Array.from(store.nodeLookup.values()).filter((n) => n.parentId === id)
        const rect = getRelativeNodesBounds(childNodes)

        return {
            minWidth: rect.x + rect.width,
            minHeight: rect.y + rect.height,
            hasChildNodes: childNodes.length > 0,
        }
    }, customIsEqual)

    // Add selected node selector
    const selectedNodeId = useSelector((state: RootState) => state.flow.selectedNode)
    const isSelected = String(id) === String(selectedNodeId)

    const nodeRef = useRef<HTMLDivElement | null>(null)
    const updateNodeInternals = useUpdateNodeInternals()

    const edges = useSelector((state: RootState) => state.flow.edges, isEqual)

    // Handle predecessor nodes logic
    const [predecessorNodes, setPredecessorNodes] = useState(() => {
        return edges
            .filter((edge) => edge.target === id)
            .map((edge) => {
                const sourceNode = nodes.find((node) => node.id === edge.source)
                if (!sourceNode) return null
                return sourceNode
            })
            .filter(Boolean)
    })

    const connection = useConnection()

    // Compute finalPredecessors using useMemo
    const finalPredecessors = useMemo(() => {
        const updatedPredecessorNodes = edges
            .filter((edge) => edge.target === id)
            .map((edge) => {
                const sourceNode = nodes.find((node) => node.id === edge.source)
                if (!sourceNode) return null
                return sourceNode
            })
            .filter(Boolean)

        let result = updatedPredecessorNodes

        if (connection.inProgress && connection.toNode && connection.toNode.id === id) {
            if (
                connection.fromNode &&
                !updatedPredecessorNodes.find((node: any) => node.id === connection.fromNode.id)
            ) {
                result = [
                    ...updatedPredecessorNodes,
                    {
                        id: connection.fromNode.id,
                        type: connection.fromNode.type,
                        data: {
                            title: (connection.fromNode.data as { title?: string })?.title || connection.fromNode.id,
                        },
                    },
                ]
            }
        }
        return result.filter((node, index, self) => self.findIndex((n) => n.id === node.id) === index)
    }, [edges, nodes, connection, id])

    useEffect(() => {
        const hasChanged =
            finalPredecessors.length !== predecessorNodes.length ||
            finalPredecessors.some((newNode, i) => !isEqual(newNode, predecessorNodes[i]))

        if (hasChanged) {
            setPredecessorNodes(finalPredecessors)
            updateNodeInternals(id)
        }
    }, [finalPredecessors, predecessorNodes, updateNodeInternals, id])

    // Handle components
    interface HandleRowProps {
        id: string
        keyName: string
    }

    const InputHandleRow: React.FC<HandleRowProps> = ({ id, keyName }) => {
        const connections = useHandleConnections({ type: 'target', id: keyName })
        const isConnectable = connections.length === 0

        return (
            <div className={`${styles.handleRow} w-full justify-end`} key={keyName}>
                <div className={`${styles.handleCell} ${styles.inputHandleCell}`}>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id={String(keyName)}
                        className={`${styles.handle} ${styles.handleLeft}`}
                        isConnectable={isConnectable}
                    />
                </div>
                <div className="border-r border-gray-300 h-full mx-0" />
                <div className="align-center flex flex-grow flex-shrink ml-[0.5rem] max-w-full overflow-hidden">
                    <span
                        className={`${styles.handleLabel} text-sm font-medium mr-auto overflow-hidden text-ellipsis whitespace-nowrap`}
                    >
                        {String(keyName)}
                    </span>
                </div>
            </div>
        )
    }

    const OutputHandleRow: React.FC<HandleRowProps> = ({ keyName }) => {
        return (
            <div className={`${styles.handleRow} w-full justify-end`} key={`output-${keyName}`}>
                <div className="align-center flex flex-grow flex-shrink mr-[0.5rem] max-w-full overflow-hidden">
                    <span
                        className={`${styles.handleLabel} text-sm font-medium ml-auto overflow-hidden text-ellipsis whitespace-nowrap`}
                    >
                        {keyName}
                    </span>
                </div>
                <div className="border-l border-gray-300 h-full mx-0" />
                <div className={`${styles.handleCell} ${styles.outputHandleCell}`}>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={keyName}
                        className={`${styles.handle} ${styles.handleRight}`}
                        isConnectable={true}
                    />
                </div>
            </div>
        )
    }

    const renderHandles = () => {
        const dedupedPredecessors = finalPredecessors.filter(
            (node, index, self) => self.findIndex((n) => n.id === node.id) === index
        )

        return (
            <div className={`${styles.handlesWrapper}`}>
                {/* Input Handles */}
                <div className={`${styles.handlesColumn} ${styles.inputHandlesColumn}`}>
                    {dedupedPredecessors.map((node) => {
                        const handleId = String(node.data?.title || node.id || '')
                        return (
                            <InputHandleRow
                                key={`input-handle-row-${node.id}-${handleId}`}
                                id={node?.id}
                                keyName={handleId}
                            />
                        )
                    })}
                </div>

                {/* Output Handle */}
                <div className={`${styles.handlesColumn} ${styles.outputHandlesColumn}`}>
                    {nodeConfig?.title && <OutputHandleRow id={id} keyName={String(nodeConfig.title)} />}
                </div>
            </div>
        )
    }

    const onDelete = () => {
        deleteElements({ nodes: [{ id }] })
    }

    const onDetach = () => {
        const childNodeIds = Array.from(store.getState().nodeLookup.values())
            .filter((n) => n.parentId === id)
            .map((n) => n.id)

        detachNodes(childNodeIds, id)
    }

    const handleTitleChange = (newTitle: string) => {
        const validTitle = convertToPythonVariableName(newTitle)
        if (validTitle && validTitle !== getNodeTitle(node['data'])) {
            dispatch(updateNodeTitle({ nodeId: id, newTitle: validTitle }))
        }
    }

    return (
        <>
            {showTitleError && (
                <Alert
                    key={`alert-${id}`}
                    className="absolute -top-16 left-0 right-0 z-50"
                    color="danger"
                    onClose={() => setShowTitleError(false)}
                >
                    Title cannot contain whitespace. Use underscores instead.
                </Alert>
            )}
            <NodeResizer
                nodeId={id}
                isVisible={true}
                lineStyle={resizerLineStyle}
                minHeight={Math.max(100, minHeight)}
                minWidth={Math.max(200, minWidth)}
                handleStyle={resizerHandleStyle}
            />
            {/* Hidden target handle covering the entire node */}
            <Handle
                type="target"
                position={Position.Left}
                id={`node-body-${id}`}
                style={staticStyles.targetHandle}
                isConnectable={true}
                isConnectableStart={false}
            />
            <NodeToolbar className="absolute top-2 right-2 z-10">
                {hasChildNodes && (
                    <button className="p-1 text-xs text-slate-600 hover:text-slate-900" onClick={onDetach}>
                        Detach
                    </button>
                )}
                <button className="p-1 text-xs text-red-600 hover:text-red-900" onClick={onDelete}>
                    Delete
                </button>
            </NodeToolbar>
            <Card
                className={`w-full h-full transition-colors duration-200 ${
                    node?.data?.className === 'active' ? 'border-blue-500 bg-blue-50/50' : ''
                }`}
                classNames={{
                    base: `bg-slate-50/50 backdrop-blur-sm outline-offset-0 outline-solid-200
                                    ${isSelected ? 'outline-[3px]' : 'outline-[1px]'} 
                                    outline-default-200 group-hover:outline-[3px]`,
                }}
            >
                <CardHeader className="relative pt-2 pb-4">
                    <div className="flex items-center">
                        {nodeConfig?.logo && (
                            <img src={nodeConfig.logo} alt="Node Logo" className="mr-2 max-h-8 max-w-8 mb-3" />
                        )}
                        {editingTitle ? (
                            <Input
                                autoFocus
                                value={titleInputValue}
                                size="sm"
                                variant="bordered"
                                radius="lg"
                                onChange={(e) => {
                                    const validValue = convertToPythonVariableName(e.target.value)
                                    setTitleInputValue(validValue)
                                    handleTitleChange(validValue)
                                }}
                                onBlur={() => setEditingTitle(false)}
                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter' || e.key === 'Escape') {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        setEditingTitle(false)
                                    }
                                }}
                                classNames={{
                                    input: 'text-foreground dark:text-white',
                                    inputWrapper: 'dark:bg-default-100/50 bg-default-100',
                                }}
                            />
                        ) : (
                            <h3
                                className="text-lg font-semibold text-center cursor-pointer hover:text-primary"
                                onClick={() => {
                                    setTitleInputValue(getNodeTitle(node['data']))
                                    setEditingTitle(true)
                                }}
                            >
                                {nodeConfig?.title || 'Group'}
                            </h3>
                        )}
                    </div>
                </CardHeader>
                {!isCollapsed && <Divider key={`divider-${id}`} />}
                <CardBody className="px-1">
                    <div className={styles.handlesWrapper} ref={nodeRef}>
                        {renderHandles()}
                    </div>
                </CardBody>
            </Card>
        </>
    )
}

type IsEqualCompareObj = {
    minWidth: number
    minHeight: number
    hasChildNodes: boolean
}

function customIsEqual(prev: IsEqualCompareObj, next: IsEqualCompareObj): boolean {
    return (
        prev.minWidth === next.minWidth &&
        prev.minHeight === next.minHeight &&
        prev.hasChildNodes === next.hasChildNodes
    )
}

export default memo(DynamicGroupNode)
