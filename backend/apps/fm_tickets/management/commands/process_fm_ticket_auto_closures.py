from django.core.management.base import BaseCommand

from apps.fm_tickets.auto_closure import process_automatic_ticket_closures


class Command(BaseCommand):
    help = (
        "Process FO-063 automatic FM Ticket closures for resolved tickets "
        "past the acknowledgement period."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=None,
            help="Override FM_TICKET_AUTO_CLOSE_BATCH_SIZE for this run.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Override FM_TICKET_AUTO_CLOSE_DAYS for this run.",
        )

    def handle(self, *args, **options):
        result = process_automatic_ticket_closures(
            days=options["days"],
            batch_size=options["batch_size"],
        )
        self.stdout.write(self.style.SUCCESS(str(result)))
