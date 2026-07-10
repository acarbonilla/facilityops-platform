from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.inspection.models import (
    Inspection,
    InspectionAIAnalysis,
    InspectionCorrectiveAction,
    InspectionFinding,
    InspectionHistory,
    InspectionItem,
    InspectionSLA,
)
from apps.inspection.services.inspection_ai_service import build_inspection_ai_context
from apps.master_data.models import Area, Building, Department, Floor, Organization, Tenant

User = get_user_model()


class InspectionTestDataMixin:
    def create_inspection_permissions(self):
        permission_definitions = [
            ("inspection.view", "inspection", "view", "View inspections"),
            ("inspection.create", "inspection", "create", "Create inspections"),
            ("inspection.update", "inspection", "update", "Update inspections"),
            ("inspection.delete", "inspection", "delete", "Delete inspections"),
            ("inspection.complete", "inspection", "complete", "Complete inspections"),
            ("inspection.verify", "inspection", "verify", "Verify inspections"),
            ("inspection.assign", "inspection", "assign", "Assign inspections"),
            ("inspection.view_ai", "inspection", "view_ai", "View inspection AI analysis"),
            (
                "inspection.manage_corrective_action",
                "inspection",
                "manage_corrective_action",
                "Manage inspection corrective actions",
            ),
            ("inspection.manage", "inspection", "manage", "Manage inspections"),
        ]
        permissions = {}
        for code, module, action, name in permission_definitions:
            permissions[code] = Permission.objects.create(
                code=code,
                module=module,
                action=action,
                name=name,
            )
        return permissions

    def assign_permissions(self, user, *permission_codes):
        role = Role.objects.create(
            name=f"Role {user.email}",
            code=f"role-{user.email.split('@')[0]}",
        )
        for permission_code in permission_codes:
            RolePermission.objects.create(
                role=role,
                permission=Permission.objects.get(code=permission_code),
            )
        UserRole.objects.create(user=user, role=role)

    def create_master_data(self):
        tenant = Tenant.objects.create(name="Tenant", code="tenant")
        organization = Organization.objects.create(
            tenant=tenant,
            name="Organization",
            code="organization",
        )
        department = Department.objects.create(
            tenant=tenant,
            organization=organization,
            name="Facilities",
            code="facilities",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name="Main Building",
            code="main-building",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name="Ground Floor",
            code="ground-floor",
            level_number=0,
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name="Lobby",
            code="lobby",
        )
        return {
            "tenant": tenant,
            "organization": organization,
            "department": department,
            "building": building,
            "floor": floor,
            "area": area,
        }

    def create_inspection_payload(self, data):
        return {
            "tenant": str(data["tenant"].id),
            "organization": str(data["organization"].id),
            "department": str(data["department"].id),
            "building": str(data["building"].id),
            "floor": str(data["floor"].id),
            "area": str(data["area"].id),
            "title": "Weekly 5S inspection",
            "inspection_type": Inspection.InspectionType.ROUTINE,
            "five_s_category": Inspection.FiveSCategory.SHINE,
            "priority": Inspection.Priority.HIGH,
            "scheduled_date": (timezone.now() + timedelta(hours=2)).isoformat(),
            "remarks": "Created from test payload.",
            "items": [
                {
                    "sequence": 1,
                    "checklist_item": "Area is labeled correctly.",
                    "category": "Sort",
                    "expected_result": "Labels match designated storage.",
                    "max_score": "5.00",
                    "score": "4.00",
                    "is_pass": True,
                    "observation": "One shelf label slightly faded.",
                }
            ],
        }

    def create_inspection_update_payload(self, data, inspector_id, supervisor_id):
        return {
            "tenant": str(data["tenant"].id),
            "organization": str(data["organization"].id),
            "department": str(data["department"].id),
            "building": str(data["building"].id),
            "floor": str(data["floor"].id),
            "area": str(data["area"].id),
            "title": "Updated 5S inspection",
            "inspection_type": Inspection.InspectionType.SPOT_CHECK,
            "five_s_category": Inspection.FiveSCategory.SUSTAIN,
            "inspection_template": "Weekly frontline walkthrough",
            "inspector": str(inspector_id),
            "supervisor": str(supervisor_id),
            "priority": Inspection.Priority.CRITICAL,
            "scheduled_date": (timezone.now() + timedelta(days=1)).isoformat(),
            "remarks": "Updated from full PUT request.",
        }

    def create_finding_update_payload(self, inspection_id, item_id):
        return {
            "inspection": str(inspection_id),
            "item": str(item_id),
            "finding_type": InspectionFinding.FindingType.IMPROVEMENT,
            "severity": InspectionFinding.Severity.HIGH,
            "description": "Updated finding description.",
            "root_cause": "Storage discipline drift.",
            "recommendation": "Reinforce the weekly 5S check.",
            "photo_path": "seed/finding-photo.jpg",
            "status": InspectionFinding.Status.IN_PROGRESS,
        }

    def create_corrective_action_payload(self, inspection, finding, assigned_to):
        return {
            "inspection": str(inspection.id),
            "finding": str(finding.id),
            "assigned_to": str(assigned_to.id),
            "due_date": (timezone.now() + timedelta(days=2)).isoformat(),
            "status": InspectionCorrectiveAction.Status.OPEN,
            "verification_status": InspectionCorrectiveAction.VerificationStatus.PENDING,
            "notes": "Initial corrective action note.",
        }

    def create_corrective_action_update_payload(self, inspection, finding, assigned_to):
        return {
            "tenant": str(inspection.tenant_id),
            "inspection": str(inspection.id),
            "finding": str(finding.id),
            "assigned_to": str(assigned_to.id),
            "due_date": (timezone.now() + timedelta(days=3)).isoformat(),
            "status": InspectionCorrectiveAction.Status.IN_PROGRESS,
            "verification_status": InspectionCorrectiveAction.VerificationStatus.PENDING,
            "notes": "Updated corrective action note.",
        }

    def create_ai_analysis_payload(self, **overrides):
        payload = {
            "summary": "Area is mostly compliant.",
            "analysis": "One dust issue and one labeling issue found.",
            "recommendation_summary": "Clean cabinet and relabel shelves.",
            "payload": {"risk": "medium"},
            "model_name": "manual-review",
            "source_notes": "Stored review from inspection team.",
        }
        payload.update(overrides)
        return payload


class InspectionModelTests(InspectionTestDataMixin, APITestCase):
    def setUp(self):
        self.data = self.create_master_data()
        self.user = User.objects.create_user(
            email="inspector@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )

    def test_inspection_creation_generates_number_and_related_models_link(self):
        inspection = Inspection.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            title="Initial inspection",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SHINE,
            inspector=self.user,
        )
        item = InspectionItem.objects.create(
            inspection=inspection,
            sequence=1,
            checklist_item="Check labels",
            max_score="5.00",
            score="5.00",
            is_pass=True,
        )
        finding = InspectionFinding.objects.create(
            inspection=inspection,
            item=item,
            finding_type=InspectionFinding.FindingType.OBSERVATION,
            severity=InspectionFinding.Severity.LOW,
            description="Minor label wear.",
        )
        action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=inspection,
            finding=finding,
            assigned_to=self.user,
            due_date=timezone.now() + timedelta(days=2),
        )

        self.assertTrue(inspection.inspection_number.startswith("INSP-"))
        self.assertEqual(finding.inspection, inspection)
        self.assertEqual(action.finding, finding)


class InspectionApiTests(InspectionTestDataMixin, APITestCase):
    def setUp(self):
        self.data = self.create_master_data()
        self.user = User.objects.create_user(
            email="manager@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.inspector = User.objects.create_user(
            email="worker@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.ai_viewer = User.objects.create_user(
            email="ai-viewer@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.ai_editor = User.objects.create_user(
            email="ai-editor@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.updater = User.objects.create_user(
            email="updater@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.deleter = User.objects.create_user(
            email="deleter@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.corrective_manager = User.objects.create_user(
            email="corrective-manager@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.other_tenant = Tenant.objects.create(name="Other Tenant", code="other-tenant")
        self.other_org = Organization.objects.create(
            tenant=self.other_tenant,
            name="Other Organization",
            code="other-organization",
        )
        self.outsider = User.objects.create_user(
            email="outsider@example.com",
            password="Password123!",
            tenant=self.other_tenant,
            organization=self.other_org,
        )
        self.create_inspection_permissions()
        self.assign_permissions(
            self.user,
            "inspection.view",
            "inspection.create",
            "inspection.update",
            "inspection.complete",
            "inspection.verify",
            "inspection.assign",
            "inspection.view_ai",
            "inspection.manage_corrective_action",
            "inspection.manage",
        )
        self.assign_permissions(self.viewer, "inspection.view")
        self.assign_permissions(self.ai_viewer, "inspection.view_ai")
        self.assign_permissions(
            self.ai_editor,
            "inspection.view_ai",
            "inspection.update",
        )
        self.assign_permissions(self.updater, "inspection.update")
        self.assign_permissions(self.deleter, "inspection.delete")
        self.assign_permissions(
            self.corrective_manager,
            "inspection.manage_corrective_action",
        )

        self.inspection = Inspection.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            title="Existing inspection",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SORT,
            priority=Inspection.Priority.MEDIUM,
            inspector=self.user,
            scheduled_date=timezone.now() + timedelta(hours=1),
        )
        self.item = InspectionItem.objects.create(
            inspection=self.inspection,
            sequence=1,
            checklist_item="Check cleanliness",
            category="Shine",
            expected_result="Area is clean",
            max_score="5.00",
            score="5.00",
            is_pass=True,
        )
        self.finding = InspectionFinding.objects.create(
            inspection=self.inspection,
            item=self.item,
            finding_type=InspectionFinding.FindingType.NON_CONFORMANCE,
            severity=InspectionFinding.Severity.MEDIUM,
            description="Dust build-up on cabinet.",
            recommendation="Clean the cabinet and add weekly check.",
        )

    def test_inspection_list_requires_authentication(self):
        response = self.client.get(reverse("inspection-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inspection_list_requires_permission(self):
        self.client.force_authenticate(self.inspector)
        response = self.client.get(reverse("inspection-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inspection_create_sets_history_and_nested_items(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("inspection-list"),
            self.create_inspection_payload(self.data),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection = Inspection.objects.get(id=response.data["id"])
        self.assertEqual(inspection.items.count(), 1)
        self.assertEqual(inspection.history_entries.count(), 1)
        self.assertEqual(inspection.status_history_entries.count(), 1)

    def test_inspection_create_allows_no_checklist_items(self):
        self.client.force_authenticate(self.user)
        payload = self.create_inspection_payload(self.data)
        payload["items"] = []

        response = self.client.post(
            reverse("inspection-list"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection = Inspection.objects.get(id=response.data["id"])
        self.assertEqual(inspection.items.count(), 0)

    def test_inspection_create_allows_partial_checklist_item_payload(self):
        self.client.force_authenticate(self.user)
        payload = self.create_inspection_payload(self.data)
        payload["items"] = [
            {
                "sequence": 1,
                "checklist_item": "Check labels",
                "max_score": "5.00",
                "category": "",
                "expected_result": "",
                "observation": "",
                "notes": "",
            }
        ]

        response = self.client.post(
            reverse("inspection-list"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection = Inspection.objects.get(id=response.data["id"])
        item = inspection.items.get(sequence=1)
        self.assertEqual(item.checklist_item, "Check labels")
        self.assertEqual(item.category, "")
        self.assertEqual(item.expected_result, "")
        self.assertIsNone(item.score)
        self.assertIsNone(item.is_pass)

    def test_inspection_create_does_not_auto_assign_cross_tenant_system_admin(self):
        global_manager = User.objects.create_user(
            email="global-manager@example.com",
            password="Password123!",
            tenant=self.other_tenant,
            organization=self.other_org,
        )
        self.assign_permissions(global_manager, "inspection.create")
        system_admin_role = Role.objects.create(
            name="System Admin",
            code="system_admin",
        )
        UserRole.objects.create(user=global_manager, role=system_admin_role)

        self.client.force_authenticate(global_manager)
        response = self.client.post(
            reverse("inspection-list"),
            self.create_inspection_payload(self.data),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        inspection = Inspection.objects.get(id=response.data["id"])
        self.assertIsNone(inspection.inspector)

    def test_inspection_list_supports_search_filter_and_tenant_scope(self):
        cross_tenant_inspection = Inspection.objects.create(
            tenant=self.other_tenant,
            organization=self.other_org,
            building=Building.objects.create(
                tenant=self.other_tenant,
                organization=self.other_org,
                name="Other Building",
                code="other-building",
            ),
            title="Hidden inspection",
            inspection_type=Inspection.InspectionType.AUDIT,
            five_s_category=Inspection.FiveSCategory.STANDARDIZE,
            priority=Inspection.Priority.LOW,
            inspector=self.outsider,
        )
        self.viewer.tenant = self.other_tenant
        self.viewer.organization = self.other_org
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))

        self.client.force_authenticate(self.user)
        response = self.client.get(
            reverse("inspection-list"),
            {"search": "Existing", "status": Inspection.Status.DRAFT},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

        self.client.force_authenticate(self.viewer)
        scoped_response = self.client.get(reverse("inspection-list"))
        self.assertEqual(scoped_response.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped_response.data["count"], 1)
        self.assertEqual(scoped_response.data["results"][0]["id"], str(cross_tenant_inspection.id))

    def test_nested_item_comment_and_attachment_endpoints_work(self):
        self.client.force_authenticate(self.user)

        item_response = self.client.post(
            reverse("inspection-items", args=[self.inspection.id]),
            {
                "sequence": 2,
                "checklist_item": "Check floor markings",
                "category": "Set In Order",
                "expected_result": "Markings are visible.",
                "max_score": "5.00",
                "score": "3.00",
                "is_pass": False,
                "observation": "One tape edge is peeling.",
            },
            format="json",
        )
        comment_response = self.client.post(
            reverse("inspection-comments", args=[self.inspection.id]),
            {"body": "Follow-up required.", "is_internal": True},
            format="json",
        )
        attachment_response = self.client.post(
            reverse("inspection-attachments", args=[self.inspection.id]),
            {
                "file_name": "evidence-photo.jpg",
                "file_path": "seed/evidence-photo.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 1024,
                "note": "Metadata only.",
            },
            format="json",
        )

        self.assertEqual(item_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(attachment_response.status_code, status.HTTP_201_CREATED)
        self.inspection.refresh_from_db()
        self.assertEqual(self.inspection.items.count(), 2)
        self.assertEqual(self.inspection.comments.count(), 1)
        self.assertEqual(self.inspection.attachments.count(), 1)
        self.assertEqual(str(self.inspection.score), "80.00")

    def test_read_only_user_can_get_nested_items_comments_and_attachments(self):
        self.client.force_authenticate(self.viewer)

        items_response = self.client.get(reverse("inspection-items", args=[self.inspection.id]))
        comments_response = self.client.get(
            reverse("inspection-comments", args=[self.inspection.id])
        )
        attachments_response = self.client.get(
            reverse("inspection-attachments", args=[self.inspection.id])
        )

        self.assertEqual(items_response.status_code, status.HTTP_200_OK)
        self.assertEqual(comments_response.status_code, status.HTTP_200_OK)
        self.assertEqual(attachments_response.status_code, status.HTTP_200_OK)
        self.assertEqual(items_response.data["count"], 1)
        self.assertEqual(comments_response.data["count"], 0)
        self.assertEqual(attachments_response.data["count"], 0)

    def test_read_only_user_cannot_post_nested_items_comments_or_attachments(self):
        self.client.force_authenticate(self.viewer)

        item_response = self.client.post(
            reverse("inspection-items", args=[self.inspection.id]),
            {
                "sequence": 2,
                "checklist_item": "Check workstation labels",
                "category": "Sort",
                "expected_result": "Labels are visible.",
                "max_score": "5.00",
                "score": "4.00",
                "is_pass": True,
            },
            format="json",
        )
        comment_response = self.client.post(
            reverse("inspection-comments", args=[self.inspection.id]),
            {"body": "Viewer should not be able to add this comment."},
            format="json",
        )
        attachment_response = self.client.post(
            reverse("inspection-attachments", args=[self.inspection.id]),
            {
                "file_name": "viewer-upload.txt",
                "file_path": "seed/viewer-upload.txt",
                "content_type": "text/plain",
                "size_bytes": 32,
            },
            format="json",
        )

        self.assertEqual(item_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(comment_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(attachment_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_user_can_post_nested_items_comments_and_attachments(self):
        self.client.force_authenticate(self.updater)

        item_response = self.client.post(
            reverse("inspection-items", args=[self.inspection.id]),
            {
                "sequence": 2,
                "checklist_item": "Check aisle markings",
                "category": "Set In Order",
                "expected_result": "Markings are intact.",
                "max_score": "5.00",
                "score": "4.00",
                "is_pass": True,
            },
            format="json",
        )
        comment_response = self.client.post(
            reverse("inspection-comments", args=[self.inspection.id]),
            {"body": "Updater can add inspection notes.", "is_internal": True},
            format="json",
        )
        attachment_response = self.client.post(
            reverse("inspection-attachments", args=[self.inspection.id]),
            {
                "file_name": "updater-upload.txt",
                "file_path": "seed/updater-upload.txt",
                "content_type": "text/plain",
                "size_bytes": 48,
                "note": "Metadata added by update-capable user.",
            },
            format="json",
        )

        self.assertEqual(item_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(attachment_response.status_code, status.HTTP_201_CREATED)

    def test_update_user_can_put_inspection(self):
        self.client.force_authenticate(self.updater)

        response = self.client.put(
            reverse("inspection-detail", args=[self.inspection.id]),
            self.create_inspection_update_payload(
                self.data,
                inspector_id=self.inspector.id,
                supervisor_id=self.user.id,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.inspection.refresh_from_db()
        self.assertEqual(self.inspection.title, "Updated 5S inspection")
        self.assertEqual(self.inspection.priority, Inspection.Priority.CRITICAL)

    def test_delete_user_can_soft_delete_inspection_and_hide_it(self):
        corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            finding=self.finding,
            assigned_to=self.inspector,
            due_date=timezone.now() + timedelta(days=1),
            status=InspectionCorrectiveAction.Status.OPEN,
        )
        self.client.force_authenticate(self.deleter)

        response = self.client.delete(reverse("inspection-detail", args=[self.inspection.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.inspection.refresh_from_db()
        self.assertTrue(self.inspection.is_deleted)
        self.assertIsNotNone(self.inspection.deleted_at)
        self.assertEqual(self.inspection.deleted_by, self.deleter.id)

        self.client.force_authenticate(self.viewer)
        list_response = self.client.get(reverse("inspection-list"))
        retrieve_response = self.client.get(reverse("inspection-detail", args=[self.inspection.id]))
        finding_list_response = self.client.get(reverse("inspection-finding-list"))
        corrective_action_list_response = self.client.get(
            reverse("inspection-corrective-action-list")
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(retrieve_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(finding_list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(finding_list_response.data["count"], 0)
        self.assertEqual(
            corrective_action_list_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(corrective_action_list_response.data["count"], 0)

        corrective_action.refresh_from_db()
        self.assertFalse(corrective_action.is_deleted)

    def test_read_only_user_cannot_put_or_delete_inspection(self):
        self.client.force_authenticate(self.viewer)

        put_response = self.client.put(
            reverse("inspection-detail", args=[self.inspection.id]),
            self.create_inspection_update_payload(
                self.data,
                inspector_id=self.inspector.id,
                supervisor_id=self.user.id,
            ),
            format="json",
        )
        delete_response = self.client.delete(
            reverse("inspection-detail", args=[self.inspection.id])
        )

        self.assertEqual(put_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_user_can_put_finding(self):
        self.client.force_authenticate(self.updater)

        response = self.client.put(
            reverse("inspection-finding-detail", args=[self.finding.id]),
            self.create_finding_update_payload(self.inspection.id, self.item.id),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.finding.refresh_from_db()
        self.assertEqual(self.finding.description, "Updated finding description.")
        self.assertEqual(self.finding.status, InspectionFinding.Status.IN_PROGRESS)

    def test_delete_user_and_manager_can_delete_finding(self):
        managed_finding = InspectionFinding.objects.create(
            inspection=self.inspection,
            item=self.item,
            finding_type=InspectionFinding.FindingType.OBSERVATION,
            severity=InspectionFinding.Severity.LOW,
            description="Secondary finding for manage delete.",
        )

        self.client.force_authenticate(self.deleter)
        delete_response = self.client.delete(
            reverse("inspection-finding-detail", args=[self.finding.id])
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.finding.refresh_from_db()
        self.assertTrue(self.finding.is_deleted)
        self.assertEqual(self.finding.deleted_by, self.deleter.id)

        self.client.force_authenticate(self.user)
        manage_delete_response = self.client.delete(
            reverse("inspection-finding-detail", args=[managed_finding.id])
        )
        self.assertEqual(manage_delete_response.status_code, status.HTTP_204_NO_CONTENT)
        managed_finding.refresh_from_db()
        self.assertTrue(managed_finding.is_deleted)
        self.assertEqual(managed_finding.deleted_by, self.user.id)

    def test_manage_corrective_action_user_can_put_corrective_action(self):
        corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            finding=self.finding,
            assigned_to=self.inspector,
            due_date=timezone.now() + timedelta(days=1),
            status=InspectionCorrectiveAction.Status.OPEN,
        )

        self.client.force_authenticate(self.corrective_manager)
        response = self.client.put(
            reverse("inspection-corrective-action-detail", args=[corrective_action.id]),
            self.create_corrective_action_update_payload(
                self.inspection,
                self.finding,
                self.user,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        corrective_action.refresh_from_db()
        self.assertEqual(
            corrective_action.status,
            InspectionCorrectiveAction.Status.IN_PROGRESS,
        )
        self.assertEqual(corrective_action.assigned_to, self.user)

    def test_delete_user_and_manager_can_delete_corrective_action(self):
        corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            finding=self.finding,
            assigned_to=self.inspector,
            due_date=timezone.now() + timedelta(days=1),
            status=InspectionCorrectiveAction.Status.OPEN,
        )
        managed_corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            finding=self.finding,
            assigned_to=self.user,
            due_date=timezone.now() + timedelta(days=2),
            status=InspectionCorrectiveAction.Status.OPEN,
        )

        self.client.force_authenticate(self.deleter)
        delete_response = self.client.delete(
            reverse("inspection-corrective-action-detail", args=[corrective_action.id])
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        corrective_action.refresh_from_db()
        self.assertTrue(corrective_action.is_deleted)
        self.assertEqual(corrective_action.deleted_by, self.deleter.id)

        self.client.force_authenticate(self.user)
        manage_delete_response = self.client.delete(
            reverse(
                "inspection-corrective-action-detail",
                args=[managed_corrective_action.id],
            )
        )
        self.assertEqual(manage_delete_response.status_code, status.HTTP_204_NO_CONTENT)
        managed_corrective_action.refresh_from_db()
        self.assertTrue(managed_corrective_action.is_deleted)
        self.assertEqual(managed_corrective_action.deleted_by, self.user.id)

    def test_read_only_user_cannot_delete_finding_or_corrective_action(self):
        corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            finding=self.finding,
            assigned_to=self.inspector,
            due_date=timezone.now() + timedelta(days=1),
            status=InspectionCorrectiveAction.Status.OPEN,
        )

        self.client.force_authenticate(self.viewer)
        finding_response = self.client.delete(
            reverse("inspection-finding-detail", args=[self.finding.id])
        )
        corrective_action_response = self.client.delete(
            reverse("inspection-corrective-action-detail", args=[corrective_action.id])
        )

        self.assertEqual(finding_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            corrective_action_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_finding_and_corrective_action_crud_work(self):
        self.client.force_authenticate(self.user)
        finding_response = self.client.post(
            reverse("inspection-finding-list"),
            {
                "inspection": str(self.inspection.id),
                "item": str(self.item.id),
                "finding_type": InspectionFinding.FindingType.IMPROVEMENT,
                "severity": InspectionFinding.Severity.LOW,
                "description": "Improve shelf label visibility.",
                "recommendation": "Use larger font labels.",
                "status": InspectionFinding.Status.OPEN,
            },
            format="json",
        )
        self.assertEqual(finding_response.status_code, status.HTTP_201_CREATED)

        corrective_action_response = self.client.post(
            reverse("inspection-corrective-action-list"),
            {
                "inspection": str(self.inspection.id),
                "finding": finding_response.data["id"],
                "assigned_to": str(self.inspector.id),
                "due_date": (timezone.now() + timedelta(days=2)).isoformat(),
                "status": InspectionCorrectiveAction.Status.OPEN,
                "verification_status": InspectionCorrectiveAction.VerificationStatus.PENDING,
                "notes": "Create larger labels.",
            },
            format="json",
        )
        self.assertEqual(corrective_action_response.status_code, status.HTTP_201_CREATED)

        patch_response = self.client.patch(
            reverse(
                "inspection-corrective-action-detail",
                args=[corrective_action_response.data["id"]],
            ),
            {
                "status": InspectionCorrectiveAction.Status.COMPLETED,
                "verification_status": InspectionCorrectiveAction.VerificationStatus.VERIFIED,
                "completion_date": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            patch_response.data["status"],
            InspectionCorrectiveAction.Status.VERIFIED,
        )

        put_finding_response = self.client.put(
            reverse("inspection-finding-detail", args=[finding_response.data["id"]]),
            {
                "inspection": str(self.inspection.id),
                "item": str(self.item.id),
                "finding_type": InspectionFinding.FindingType.IMPROVEMENT,
                "severity": InspectionFinding.Severity.MEDIUM,
                "description": "Update created finding through full PUT.",
                "root_cause": "Label drift.",
                "recommendation": "Refresh shelf labels.",
                "status": InspectionFinding.Status.RESOLVED,
            },
            format="json",
        )
        self.assertEqual(put_finding_response.status_code, status.HTTP_200_OK)

    def test_assign_start_complete_verify_workflow(self):
        self.client.force_authenticate(self.user)

        assign_response = self.client.post(
            reverse("inspection-assign", args=[self.inspection.id]),
            {
                "inspector": str(self.inspector.id),
                "supervisor": str(self.user.id),
                "note": "Assign to inspector and supervisor.",
            },
            format="json",
        )
        self.assertEqual(assign_response.status_code, status.HTTP_200_OK)

        start_response = self.client.post(
            reverse("inspection-start", args=[self.inspection.id]),
            {"note": "Inspection started."},
            format="json",
        )
        self.assertEqual(start_response.status_code, status.HTTP_200_OK)

        complete_response = self.client.post(
            reverse("inspection-complete", args=[self.inspection.id]),
            {"note": "Inspection completed."},
            format="json",
        )
        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)

        corrective_action = InspectionCorrectiveAction.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            finding=self.finding,
            assigned_to=self.inspector,
            due_date=timezone.now() + timedelta(days=1),
            status=InspectionCorrectiveAction.Status.OPEN,
        )
        blocked_verify = self.client.post(
            reverse("inspection-verify", args=[self.inspection.id]),
            {"note": "Try to verify too early."},
            format="json",
        )
        self.assertEqual(blocked_verify.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("corrective_actions", blocked_verify.data)

        corrective_action.status = InspectionCorrectiveAction.Status.COMPLETED
        corrective_action.verification_status = (
            InspectionCorrectiveAction.VerificationStatus.VERIFIED
        )
        corrective_action.completion_date = timezone.now()
        corrective_action.save()

        verify_response = self.client.post(
            reverse("inspection-verify", args=[self.inspection.id]),
            {"note": "Verified after action closure."},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.inspection.refresh_from_db()
        self.assertEqual(self.inspection.status, Inspection.Status.VERIFIED)

    def test_ai_analysis_view_ai_user_can_get(self):
        InspectionAIAnalysis.objects.create(
            inspection=self.inspection,
            summary="Stored AI summary.",
            analysis="Stored AI analysis.",
            recommendation_summary="Stored AI recommendations.",
            payload={"risk": "low"},
            model_name="manual",
            source_notes="Stored review.",
        )

        self.client.force_authenticate(self.ai_viewer)
        response = self.client.get(reverse("inspection-ai-analysis", args=[self.inspection.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"], "Stored AI summary.")
        self.assertIn("context_preview", response.data)

    def test_ai_analysis_get_does_not_create_or_update_inspection_sla(self):
        self.client.force_authenticate(self.ai_viewer)
        url = reverse("inspection-ai-analysis", args=[self.inspection.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(InspectionSLA.objects.filter(inspection=self.inspection).exists())

        last_recalculated_at = timezone.now() - timedelta(days=1)
        sla = InspectionSLA.objects.create(
            tenant=self.data["tenant"],
            inspection=self.inspection,
            target_minutes=17,
            warning_minutes=3,
            sla_status=InspectionSLA.Status.NOT_STARTED,
            last_recalculated_at=last_recalculated_at,
        )
        original_updated_at = sla.updated_at

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sla.refresh_from_db()
        self.assertEqual(sla.target_minutes, 17)
        self.assertEqual(sla.warning_minutes, 3)
        self.assertEqual(sla.sla_status, InspectionSLA.Status.NOT_STARTED)
        self.assertEqual(sla.last_recalculated_at, last_recalculated_at)
        self.assertEqual(sla.updated_at, original_updated_at)

    def test_ai_analysis_view_ai_user_cannot_post(self):
        self.client.force_authenticate(self.ai_viewer)
        response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            InspectionAIAnalysis.objects.filter(inspection=self.inspection).exists()
        )

    def test_ai_analysis_update_user_can_create_when_no_record_exists(self):
        self.client.force_authenticate(self.updater)
        response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(model_name=""),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ai_analysis = InspectionAIAnalysis.objects.get(inspection=self.inspection)
        self.assertEqual(ai_analysis.model_name, "manual")

    def test_ai_analysis_update_user_cannot_overwrite_existing_hidden_record(self):
        existing = InspectionAIAnalysis.objects.create(
            inspection=self.inspection,
            summary="Existing summary.",
            analysis="Existing analysis.",
            recommendation_summary="Existing recommendations.",
            payload={"risk": "medium"},
            model_name="manual",
            source_notes="Existing review.",
        )

        self.client.force_authenticate(self.updater)
        response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(
                summary="Updated summary.",
                analysis="Updated analysis.",
                recommendation_summary="Updated recommendations.",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        existing.refresh_from_db()
        self.assertEqual(existing.summary, "Existing summary.")

    def test_ai_analysis_manage_user_can_get_and_post(self):
        self.client.force_authenticate(self.user)
        get_response = self.client.get(reverse("inspection-ai-analysis", args=[self.inspection.id]))
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data, {})

        post_response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(),
            format="json",
        )
        self.assertEqual(post_response.status_code, status.HTTP_201_CREATED)

    def test_ai_analysis_empty_post_is_rejected(self):
        self.client.force_authenticate(self.updater)
        response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(
                summary=" ",
                analysis=" ",
                recommendation_summary=" ",
                payload={},
                model_name=" ",
                source_notes=" ",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_ai_analysis_valid_post_creates_record_and_history(self):
        self.client.force_authenticate(self.updater)
        response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(model_name=" "),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ai_analysis = InspectionAIAnalysis.objects.get(inspection=self.inspection)
        self.assertEqual(ai_analysis.summary, "Area is mostly compliant.")
        self.assertEqual(ai_analysis.model_name, "manual")
        self.assertTrue(
            self.inspection.history_entries.filter(action="ai_analysis_updated").exists()
        )

    def test_ai_analysis_view_ai_and_update_user_can_update(self):
        self.client.force_authenticate(self.ai_editor)
        first_response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(summary="First summary."),
            format="json",
        )
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)

        second_response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(
                summary="Updated summary.",
                analysis="Updated analysis.",
                recommendation_summary="Updated recommendations.",
                payload={"risk": "high"},
            ),
            format="json",
        )

        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(InspectionAIAnalysis.objects.filter(inspection=self.inspection).count(), 1)
        ai_analysis = InspectionAIAnalysis.objects.get(inspection=self.inspection)
        self.assertEqual(ai_analysis.summary, "Updated summary.")
        self.assertEqual(ai_analysis.payload, {"risk": "high"})

    def test_ai_analysis_manage_user_can_update(self):
        InspectionAIAnalysis.objects.create(
            inspection=self.inspection,
            summary="Existing summary.",
            analysis="Existing analysis.",
            recommendation_summary="Existing recommendations.",
            payload={"risk": "medium"},
            model_name="manual",
            source_notes="Existing review.",
        )

        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(
                summary="Manage updated summary.",
                analysis="Manage updated analysis.",
                recommendation_summary="Manage updated recommendations.",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ai_analysis = InspectionAIAnalysis.objects.get(inspection=self.inspection)
        self.assertEqual(ai_analysis.summary, "Manage updated summary.")

    def test_build_inspection_ai_context_returns_structured_context(self):
        InspectionItem.objects.create(
            inspection=self.inspection,
            sequence=2,
            checklist_item="Check aisle markings",
            category="Set In Order",
            expected_result="Aisle markings are visible.",
            max_score="5.00",
            score="2.00",
            is_pass=False,
            observation="Paint is fading near the rack.",
            notes="Needs repainting.",
        )
        corrective_action = InspectionCorrectiveAction.objects.create(
            inspection=self.inspection,
            tenant=self.inspection.tenant,
            finding=self.finding,
            assigned_to=self.inspector,
            due_date=timezone.now() + timedelta(days=2),
            status=InspectionCorrectiveAction.Status.OPEN,
            verification_status=InspectionCorrectiveAction.VerificationStatus.PENDING,
            notes="Repaint aisle markings.",
        )

        context = build_inspection_ai_context(inspection=self.inspection)

        self.assertEqual(context["inspection"]["inspection_number"], self.inspection.inspection_number)
        self.assertEqual(context["location"]["building_name"], self.data["building"].name)
        self.assertEqual(len(context["checklist"]), 2)
        self.assertEqual(context["checklist"][1]["checklist_item"], "Check aisle markings")
        self.assertEqual(context["findings"][0]["description"], self.finding.description)
        self.assertEqual(len(context["corrective_actions"]), 1)
        self.assertEqual(
            context["corrective_actions"][0]["verification_status"],
            corrective_action.verification_status,
        )
        self.assertEqual(context["summary_counts"]["checklist_item_count"], 2)
        self.assertEqual(context["summary_counts"]["failed_item_count"], 1)
        self.assertEqual(context["summary_counts"]["finding_count"], 1)
        self.assertEqual(context["summary_counts"]["open_corrective_action_count"], 1)

    def test_ai_analysis_tenant_scoping_remains_enforced(self):
        self.assign_permissions(
            self.outsider,
            "inspection.view_ai",
            "inspection.update",
        )
        self.client.force_authenticate(self.outsider)

        get_response = self.client.get(reverse("inspection-ai-analysis", args=[self.inspection.id]))
        post_response = self.client.post(
            reverse("inspection-ai-analysis", args=[self.inspection.id]),
            self.create_ai_analysis_payload(),
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(post_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inspection_detail_hides_ai_analysis_without_view_ai_permission(self):
        InspectionAIAnalysis.objects.create(
            inspection=self.inspection,
            summary="Restricted AI summary.",
            analysis="Restricted AI analysis.",
            recommendation_summary="Restricted recommendations.",
            payload={"risk": "medium"},
            model_name="manual",
            source_notes="Restricted review.",
        )

        self.client.force_authenticate(self.viewer)
        response = self.client.get(reverse("inspection-detail", args=[self.inspection.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["ai_analysis"])
        self.assertTrue(response.data["ai_analysis_exists"])

    def test_history_endpoint_returns_entries(self):
        InspectionHistory.objects.create(
            inspection=self.inspection,
            actor=self.user,
            action="manual_note",
            description="History note.",
        )
        self.client.force_authenticate(self.viewer)
        response = self.client.get(reverse("inspection-history", args=[self.inspection.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_reopen_workflow_from_cancelled(self):
        self.client.force_authenticate(self.user)
        cancel_response = self.client.post(
            reverse("inspection-cancel", args=[self.inspection.id]),
            {"reason": "Schedule conflict"},
            format="json",
        )
        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)

        reopen_response = self.client.post(
            reverse("inspection-reopen", args=[self.inspection.id]),
            {"reason": "Conflict resolved"},
            format="json",
        )
        self.assertEqual(reopen_response.status_code, status.HTTP_200_OK)
        self.inspection.refresh_from_db()
        self.assertEqual(self.inspection.status, Inspection.Status.REOPENED)


class InspectionSeedCommandTests(InspectionTestDataMixin, APITestCase):
    def setUp(self):
        User.objects.create_user(
            email="seed-user@example.com",
            password="Password123!",
        )
        User.objects.create_user(
            email="seed-user-2@example.com",
            password="Password123!",
        )
        call_command("seed_master_data")

    def test_seed_command_is_idempotent(self):
        call_command("seed_inspection")
        call_command("seed_inspection")

        self.assertEqual(Inspection.objects.count(), 2)
        self.assertGreaterEqual(InspectionItem.objects.count(), 4)
        self.assertGreaterEqual(InspectionFinding.objects.count(), 2)
        self.assertGreaterEqual(InspectionCorrectiveAction.objects.count(), 2)


class InspectionSeedRbacCommandTests(APITestCase):
    def test_seed_rbac_remains_idempotent_for_inspection_permissions(self):
        call_command("seed_rbac")
        call_command("seed_rbac")

        self.assertEqual(Permission.objects.filter(code="inspection.manage").count(), 1)
        self.assertEqual(
            Permission.objects.filter(code="inspection.manage_corrective_action").count(),
            1,
        )
