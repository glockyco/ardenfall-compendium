using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallArchives.Entities.Item;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control.Handlers;

public sealed class EntityPlanCommand : IControlCommandHandler
{
    private const int BatchSize = 100;

    public ControlCommandDescriptor Descriptor { get; } = new(
        "entity.plan",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: ArchiveCommandSchemas.AnyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var entity = args["entity"]?.Value<string>();
        if (entity != "item")
            return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Validation("unsupportedEntity", "Only entity 'item' is supported."));

        var total = new ItemExtractor().Walk().Count();
        return new ValueTask<ControlCommandResult>(ArchiveCommandResults.Ok(new JObject
        {
            ["entity"] = "item",
            ["total"] = total,
            ["batchSize"] = BatchSize,
            ["batches"] = total == 0 ? 0 : (total + BatchSize - 1) / BatchSize,
        }));
    }
}
