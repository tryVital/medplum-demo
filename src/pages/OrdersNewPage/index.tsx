import {
  Button,
  Center,
  Group,
  InputLabel,
  MultiSelect,
  Pill,
  Select,
  Space,
  Stack,
  Stepper,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { Coverage, Patient, Practitioner, QuestionnaireResponse } from '@medplum/fhirtypes';
import {
  CodeInput,
  Document,
  Loading,
  OperationOutcomeAlert,
  QuestionnaireForm,
  ResourceInput,
  useMedplum,
} from '@medplum/react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Lab, useFetchLabs } from '../../lib/api/labs';
import { LabTest, useFetchLabTests } from '../../lib/api/labtests';
import { useFetchMarkers, useFetchQuestionnaireItems } from '../../lib/api/markers';
import { UUID } from 'uuidjs';
import { useFetchUsers } from '../../lib/api/users';
import { useNavigate } from 'react-router-dom';
import { useICD10CM } from '../../lib/api/icd10cm';

export function OrdersNewPage(): JSX.Element {
  return (
    <Document>
      <Title>Orders</Title>
      <Space h="lg" />
      <Demo />
    </Document>
  );
}

type FormData = {
  userID?: string;
  patient?: Patient;
  lab?: Lab;
  labTest?: LabTest;
  questionnaire?: QuestionnaireResponse;
  physician?: Practitioner;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  coverage: {
    payorCode?: string;
    insuranceId?: string;
    subjective?: string;
    assessmentPlan?: string;
    responsibleRelationship?: 'self' | 'spouse' | 'other';
    diagnosisCodes?: string[];
    // TODO: Use coverage police holder for responsible party (either Patient or RelatedPerson)
  };
};

function Demo() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const nextStep = () => setActive((current) => (current < 3 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  const [formData, setFormData] = useState<FormData>({
    coverage: {},
  });

  const setPatient = useCallback((patient: Patient | undefined) => setFormData((prev) => ({ ...prev, patient })), []);
  const setCoverage = useCallback(
    (coverage: FormData['coverage']) => setFormData((prev) => ({ ...prev, coverage })),
    []
  );
  const setLab = useCallback((lab: Lab | undefined) => setFormData((prev) => ({ ...prev, lab })), []);
  const setLabTest = useCallback((labTest: LabTest | undefined) => setFormData((prev) => ({ ...prev, labTest })), []);
  const setPriority = useCallback(
    (priority: FormData['priority']) => setFormData((prev) => ({ ...prev, priority })),
    []
  );
  const setPhysician = useCallback(
    (physician: Practitioner | undefined) => setFormData((prev) => ({ ...prev, physician })),
    []
  );
  const setQuestionnaire = useCallback(
    (questionnaire: QuestionnaireResponse | undefined) => setFormData((prev) => ({ ...prev, questionnaire })),
    []
  );
  const setUserID = useCallback((userID: string) => setFormData((prev) => ({ ...prev, userID })), []);

  const handleSubmit = async () => {
    if (!formData.patient || !formData.labTest || !formData.questionnaire || !formData.physician || !formData.lab) {
      // TODO: Show warning
      return;
    }

    const { id: questionarieID } = await medplum.createResource(formData.questionnaire);

    const { id: coverageID } = await medplum.createResource({
      resourceType: 'Coverage',
      network: formData.coverage.payorCode,
      subscriberId: formData.coverage.insuranceId,
      status: 'active',
      beneficiary: {
        reference: `Patient/${formData.patient.id}`,
      },
      extension: [
        ...(formData.coverage.diagnosisCodes || []).map((code) => ({
          url: 'diagnosis_code',
          valueString: code,
        })),
        {
          url: 'subjective',
          valueString: formData.coverage.subjective,
        },
        {
          url: 'assessment_plan',
          valueString: formData.coverage.assessmentPlan,
        },
      ],
      payor: [
        {
          reference: `Patient/${formData.patient.id}`,
        },
      ],
      relationship: {
        coding: [
          {
            system: 'https://fhir-ru.github.io/valueset-subscriber-relationship.html',
            code: formData.coverage.responsibleRelationship?.toLowerCase() || 'self',
          },
        ],
      },
    } as Coverage); // TODO: Coverage is not the ideal resource for this (InsurancePlan maybe?)

    await medplum.createResource({
      resourceType: 'ServiceRequest',
      intent: 'order',
      status: 'active',
      subject: {
        reference: `Patient/${formData.patient.id}`,
        type: 'Patient',
      },
      requester: {
        reference: `Practitioner/${formData.physician.id}`,
        type: 'Practitioner',
      },
      extension: [
        {
          url: 'lab_test_id',
          valueString: formData.labTest.id,
        },
        {
          url: 'user_id',
          valueString: formData.userID,
        },
      ],
      insurance: [
        {
          reference: `Coverage/${coverageID}`,
          type: 'Coverage',
        },
      ],
      priority: formData.priority,
      supportingInfo: [
        {
          reference: `QuestionnaireResponse/${questionarieID}`,
          type: 'QuestionnaireResponse',
        },
      ],
    });

    navigate('/orders');
  };

  return (
    <>
      <Stepper active={active} onStepClick={setActive}>
        <Stepper.Step label="Patient" description="Patient information">
          <PatientStep
            nextStep={nextStep}
            prevStep={prevStep}
            formData={formData}
            setPatient={setPatient}
            setCoverage={setCoverage}
          />
        </Stepper.Step>
        <Stepper.Step label="Vendor" description="Lab Selection">
          <VendorStep nextStep={nextStep} prevStep={prevStep} formData={formData} setLab={setLab} />
        </Stepper.Step>
        <Stepper.Step label="Tests" description="Panels">
          <TestStep
            nextStep={nextStep}
            prevStep={prevStep}
            formData={formData}
            setLabTest={setLabTest}
            setQuestionnaire={setQuestionnaire}
            setPriority={setPriority}
            setPhysician={setPhysician}
            setCoverage={setCoverage}
          />
        </Stepper.Step>
        <Stepper.Completed>
          <ConfirmStep handleSubmit={handleSubmit} setUserID={setUserID} />
        </Stepper.Completed>
      </Stepper>
    </>
  );
}

type StepProps = {
  formData: FormData;
  nextStep: () => void;
  prevStep: () => void;
};

type PatientStepProps = StepProps & {
  setPatient: (patient: Patient | undefined) => void;
  setCoverage: (coverage: FormData['coverage']) => void;
};

function PatientStep({ nextStep, prevStep, formData, setPatient, setCoverage }: PatientStepProps) {
  return (
    <form>
      <Space h="lg" />
      <>
        <InputLabel>
          Patient <span style={{ color: 'red' }}>*</span>
        </InputLabel>
        <ResourceInput<Patient>
          name="patient"
          resourceType="Patient"
          onChange={setPatient}
          defaultValue={formData.patient}
          required
          loadOnFocus
        />
      </>
      <Space h="xl" />
      <Title order={3}>Insurance</Title>
      <Space h="xl" />

      <Stack>
        <Group grow>
          <TextInput
            label="Payor Code"
            description="Unique identifier representing a specific Health Insurance."
            required
            value={formData.coverage.payorCode}
            onChange={(e) => setCoverage({ ...formData.coverage, payorCode: e.currentTarget.value })}
          />
          <TextInput
            label="Insurance ID"
            description="Insurance unique number assigned to a patient."
            required
            value={formData.coverage.insuranceId}
            onChange={(e) => setCoverage({ ...formData.coverage, insuranceId: e.currentTarget.value })}
          />
        </Group>
        <Group grow>
          <Select
            label="Responsible Relationship"
            description="The relationship of the insured to the beneficiary."
            required
            data={[
              { value: 'self', label: 'Self' },
              { value: 'spouse', label: 'Spouse' },
              { value: 'other', label: 'Other' },
            ]}
            defaultValue="self"
            value={formData.coverage.responsibleRelationship}
            onChange={(_, opt) =>
              setCoverage({
                ...formData.coverage,
                responsibleRelationship: opt.value as FormData['coverage']['responsibleRelationship'],
              })
            }
          />
        </Group>

        <Group grow>
          <Textarea
            label="Subjective"
            description="Textual description of patient's symptoms and attempted treatments."
            value={formData.coverage.subjective}
            onChange={(e) => setCoverage({ ...formData.coverage, subjective: e.currentTarget.value })}
          />

          <Textarea
            label="Assessment Plan"
            description="Textual description of physician's assessments and testing plans."
            value={formData.coverage.assessmentPlan}
            onChange={(e) => setCoverage({ ...formData.coverage, assessmentPlan: e.currentTarget.value })}
          />
        </Group>
        {/*
         * TODO: Add responsible party fields (used them to create a "Person" resource)
         * */}
      </Stack>

      <Control nextStep={nextStep} prevStep={prevStep} />
    </form>
  );
}

type VendorStepProps = StepProps & {
  setLab: (lab: Lab | undefined) => void;
};

function VendorStep({ nextStep, prevStep, formData, setLab }: VendorStepProps) {
  const { labs } = useFetchLabs();
  const { labTests } = useFetchLabTests({ labID: formData.lab?.id });
  const hasLabTests = labTests?.length !== 0;

  return (
    <>
      <Space h="lg" />
      <Stack>
        <Select
          label="Lab"
          required
          data={labs?.map((l) => ({ value: l.id.toString(), label: l.name }))}
          value={formData.lab?.id.toString()}
          onChange={(_, opt) => setLab(labs?.find((l) => l.id.toString() === opt.value))}
        />

        {!hasLabTests && (
          <OperationOutcomeAlert
            outcome={{
              resourceType: 'OperationOutcome',
              id: 'not-found',
              issue: [
                {
                  severity: 'error',
                  code: 'not-found',
                  details: {
                    text: 'No lab tests found for this lab.',
                  },
                },
              ],
            }}
          />
        )}
      </Stack>

      <Control nextStep={nextStep} prevStep={prevStep} />
    </>
  );
}

type TestStepProps = StepProps & {
  setLabTest: (labTest: LabTest | undefined) => void;
  setQuestionnaire: (questionnaire: QuestionnaireResponse | undefined) => void;
  setPriority: (priority: FormData['priority']) => void;
  setPhysician: (physician: Practitioner | undefined) => void;
  setCoverage: (coverage: FormData['coverage']) => void;
};

function TestStep({
  nextStep,
  prevStep,
  formData,
  setLabTest,
  setQuestionnaire,
  setPriority,
  setPhysician,
  setCoverage,
}: TestStepProps) {
  const { labTests, isLoading } = useFetchLabTests({ labID: formData.lab?.id });
  const hasLabTests = labTests?.length !== 0;

  const hasAOE = useMemo(() => formData.labTest?.markers?.some((m) => m.aoe.questions.length > 0), [formData.labTest]);

  const [searchValue, setSearchValue] = useState('');

  const { options } = useICD10CM({ search: searchValue });

  return (
    <>
      <Space h="lg" />
      <Stack>
        <>
          <InputLabel>
            Physician <span style={{ color: 'red' }}>*</span>
          </InputLabel>
          <ResourceInput<Practitioner>
            name="physician"
            resourceType="Practitioner"
            required
            loadOnFocus
            onChange={setPhysician}
            defaultValue={formData.physician}
          />
        </>

        <Select
          label="Panel"
          required
          disabled={!formData.lab || !hasLabTests || isLoading}
          data={labTests?.map((l) => ({ value: l.id, label: l.name }))}
          value={formData.labTest?.id}
          onChange={(_, opt) => setLabTest(labTests?.find((l) => l.id === opt.value))}
        />
        {formData.labTest && (
          <Suspense fallback={<Loading />}>
            <MarkersList labTestID={formData.labTest.id} />
          </Suspense>
        )}

        <Select
          label="Priority"
          required
          value={formData.priority}
          data={[
            { value: 'routine', label: 'Routine' },
            { value: 'urgent', label: 'Urgent' },
            { value: 'asap', label: 'ASAP' },
            { value: 'stat', label: 'Stat' },
          ]}
          onChange={(_, opt) => setPriority(opt.value as FormData['priority'])}
        />

        <MultiSelect
          label="Diagnosis Codes"
          name="diagnosis_codes"
          data={options}
          searchable
          onChange={(values) => setCoverage({ ...formData.coverage, diagnosisCodes: values })}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />

        {!hasLabTests && (
          <OperationOutcomeAlert
            outcome={{
              resourceType: 'OperationOutcome',
              id: 'not-found',
              issue: [
                {
                  severity: 'error',
                  code: 'not-found',
                  details: {
                    text: 'No lab tests found for this lab.',
                  },
                },
              ],
            }}
          />
        )}
      </Stack>

      <Space h="lg" />

      {formData.labTest && (
        <Suspense fallback={<Loading />}>
          <QuestionnaireList
            labTestID={formData.labTest.id}
            setQuestionnaire={(q) => {
              setQuestionnaire(q);
              nextStep();
            }}
          />
        </Suspense>
      )}

      {!hasAOE && <Control nextStep={nextStep} prevStep={prevStep} />}
    </>
  );
}

function QuestionnaireList({
  labTestID,
  setQuestionnaire,
}: {
  labTestID: string;
  setQuestionnaire: TestStepProps['setQuestionnaire'];
}) {
  const { markers, isLoading } = useFetchQuestionnaireItems({ labID: labTestID });

  if (isLoading || markers.length === 0) {
    return null;
  }

  return (
    <QuestionnaireForm
      questionnaire={{
        resourceType: 'Questionnaire',
        id: UUID.genV4().toString(),
        title: 'Ask on Order Entry (AOE)',
        item: markers,
      }}
      submitButtonText="Preview"
      onSubmit={setQuestionnaire}
    />
  );
}

function MarkersList({ labTestID }: { labTestID: string }) {
  const { markers } = useFetchMarkers({ labTestID });

  return <Pill.Group>{markers?.map((m) => <Pill key={m.id}>{m.name}</Pill>)}</Pill.Group>;
}

function Control({ nextStep, prevStep }: { nextStep: () => void; prevStep: () => void }) {
  return (
    <Group justify="end" mt="xl">
      <Button variant="default" onClick={prevStep}>
        Back
      </Button>
      <Button onClick={nextStep}>Next step</Button>
    </Group>
  );
}

function ConfirmStep({ handleSubmit, setUserID }: { handleSubmit: () => void; setUserID: (userID: string) => void }) {
  const { users } = useFetchUsers();

  useEffect(() => {
    if (!users) return;

    setUserID(users[0].user_id);
  }, [users]);

  return (
    <>
      <Center>
        <Title>Are you sure you want to submit the order?</Title>
      </Center>
      <Group justify="end">
        <Button onClick={handleSubmit}>Create Order</Button>
      </Group>
    </>
  );
}
