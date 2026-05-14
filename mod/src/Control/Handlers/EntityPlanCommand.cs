using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Extraction;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class EntityPlanCommand : IControlCommandHandler
{
    private const int BatchSize = 100;
    private readonly CompendiumRunManager _runs;
    private readonly ItemExtractionService _items;

    public EntityPlanCommand(CompendiumRunManager runs, ItemExtractionService items)
    {
        _runs = runs;
        _items = items;
    }


    public ControlCommandDescriptor Descriptor { get; } = new(
        "entity.plan",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: CompendiumCommandSchemas.AnyObject,
        resultSchema: CompendiumCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var entity = args["entity"]?.Value<string>();
        if (entity != "item")
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("unsupportedEntity", "Only entity 'item' is supported."));

        var runId = args["runId"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(runId))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("runIdRequired", "runId is required."));
        if (!_runs.TryGet(runId, out var run))
            return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Validation("unknownRun", $"Unknown run '{runId}'."));

        var total = _items.GetOrExtract(run).Count;
        return new ValueTask<ControlCommandResult>(CompendiumCommandResults.Ok(new JObject
        {
            ["entity"] = "item",
            ["total"] = total,
            ["batchSize"] = BatchSize,
            ["batches"] = total == 0 ? 0 : (total + BatchSize - 1) / BatchSize,
        }));
    }
}
