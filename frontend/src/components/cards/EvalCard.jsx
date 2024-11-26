import React, { useState, useEffect } from "react";
import { Card, CardBody, CardFooter, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { Icon } from "@iconify/react";
import { getWorkflows, getWorkflowOutputVariables } from "../../utils/api"; // Import the new API function
import { toast } from "sonner";

export default function EvalCard({ title, description, type, dataPoints, paperLink, onRun }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [outputVariables, setOutputVariables] = useState([]);
  const [selectedOutputVariable, setSelectedOutputVariable] = useState(null);

  // Fetch workflows when the modal opens
  useEffect(() => {
    if (isModalOpen) {
      const fetchWorkflows = async () => {
        try {
          const workflowsData = await getWorkflows();
          setWorkflows(workflowsData);
        } catch (error) {
          console.error("Error fetching workflows:", error);
          toast.error("Failed to load workflows.");
        }
      };

      fetchWorkflows();
    }
  }, [isModalOpen]);

  // Fetch output variables when a workflow is selected
  useEffect(() => {
    if (selectedWorkflow) {
      const fetchOutputVariables = async () => {
        try {
          const variables = await getWorkflowOutputVariables(selectedWorkflow.id);
          setOutputVariables(variables);
        } catch (error) {
          console.error("Error fetching output variables:", error);
          toast.error("Failed to load output variables.");
        }
      };

      fetchOutputVariables();
    }
  }, [selectedWorkflow]);

  const handleRunEval = () => {
    if (!selectedWorkflow) {
      toast.error("Please select a workflow.");
      return;
    }
    if (!selectedOutputVariable) {
      toast.error("Please select an output variable.");
      return;
    }

    // Pass the selected workflow ID and output variable to the onRun function
    onRun(selectedWorkflow.id, selectedOutputVariable);
    setIsModalOpen(false); // Close the modal
  };

  return (
    <>
      <Card className="relative w-full">
        <CardBody className="relative min-h-[220px] bg-gradient-to-br from-content1 to-default-100/50 p-6">
          <h2 className="text-xl font-semibold mb-2">{title}</h2>
          <p className="text-default-500 text-sm mb-3">{description}</p>
          <p className="text-default-500 text-sm mb-1"><strong>Type:</strong> {type}</p>
          <p className="text-default-500 text-sm mb-1"><strong>Data Points:</strong> {dataPoints}</p>
          {paperLink && (
            <a href={paperLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm">
              Original Paper
            </a>
          )}
        </CardBody>
        <CardFooter className="border-t-1 border-default-100 justify-end py-2 px-4">
          <Button
            color="primary"
            variant="flat"
            onPress={() => setIsModalOpen(true)} // Open the modal
            startContent={<Icon icon="solar:play-linear" width={16} />}
          >
            Run Eval
          </Button>
        </CardFooter>
      </Card>

      {/* Modal for selecting a workflow and output variable */}
      <Modal isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Select Workflow and Output Variable</ModalHeader>
              <ModalBody>
                {/* Heading for Workflow selection */}
                <h3 className="text-sm font-semibold mb-2">Select a Workflow</h3>
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="flat" color="primary">
                      {selectedWorkflow ? selectedWorkflow.name : "Select a Workflow"}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Workflows"
                    onAction={(key) => {
                      const workflow = workflows.find((wf) => wf.id === key);
                      setSelectedWorkflow(workflow);
                      setSelectedOutputVariable(null); // Reset output variable
                    }}
                  >
                    {workflows.map((workflow) => (
                      <DropdownItem key={workflow.id}>{workflow.name}</DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>

                {selectedWorkflow && (
                  <>
                    {/* Heading for Output Variable selection */}
                    <h3 className="text-sm font-semibold mt-4 mb-2">Select an Output Variable</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button variant="flat" color="primary">
                          {selectedOutputVariable || "Select an Output Variable"}
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Output Variables"
                        onAction={(key) => setSelectedOutputVariable(key)}
                      >
                        {outputVariables.map((variable) => (
                          <DropdownItem key={variable}>{variable}</DropdownItem>
                        ))}
                      </DropdownMenu>
                    </Dropdown>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleRunEval}>
                  Run Eval
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}