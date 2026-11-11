"""Django test runner that saves per-test results to an Excel workbook."""

import unittest
from pathlib import Path

from django.conf import settings
from django.test.runner import DiscoverRunner
from openpyxl import Workbook


class ExcelTestResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_records = []

    @staticmethod
    def test_name(test):
        return test.id() if hasattr(test, "id") else str(test)

    @staticmethod
    def test_purpose(test):
        description = test.shortDescription() if hasattr(test, "shortDescription") else None
        if description:
            return description

        method_name = getattr(test, "_testMethodName", "")
        purpose = method_name.removeprefix("test_").replace("_", " ").strip()
        return purpose[:1].upper() + purpose[1:] if purpose else "Automated test"

    def record(self, test, status, purpose=None):
        self.test_records.append({
            "test_name": self.test_name(test),
            "purpose": purpose or self.test_purpose(test),
            "status": status,
        })

    def addSuccess(self, test):
        super().addSuccess(test)
        self.record(test, "PASS")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.record(test, "FAIL")

    def addError(self, test, err):
        super().addError(test, err)
        self.record(test, "FAIL")

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.record(test, "FAIL", f"{self.test_purpose(test)} (skipped: {reason})")

    def addExpectedFailure(self, test, err):
        super().addExpectedFailure(test, err)
        self.record(test, "PASS")

    def addUnexpectedSuccess(self, test):
        super().addUnexpectedSuccess(test)
        self.record(test, "FAIL")


class ExcelDiscoverRunner(DiscoverRunner):
    """Run Django tests and write their outcomes to ``test_results.xlsx``."""

    def get_resultclass(self):
        return ExcelTestResult

    def run_suite(self, suite, **kwargs):
        result = super().run_suite(suite, **kwargs)
        self.write_excel_report(result.test_records)
        return result

    @staticmethod
    def write_excel_report(test_records):
        report_path = Path(
            getattr(settings, "TEST_RESULTS_XLSX", settings.BASE_DIR / "test_results.xlsx")
        )
        report_path.parent.mkdir(parents=True, exist_ok=True)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Test Results"
        sheet.append(["Test Name", "Purpose", "Status"])

        for record in test_records:
            sheet.append([
                record["test_name"],
                record["purpose"],
                record["status"],
            ])

        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        sheet.column_dimensions["A"].width = 72
        sheet.column_dimensions["B"].width = 64
        sheet.column_dimensions["C"].width = 12
        workbook.save(report_path)
        print(f"\nExcel test report written to: {report_path}")
