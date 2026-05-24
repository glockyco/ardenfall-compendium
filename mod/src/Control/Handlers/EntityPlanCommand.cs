using System;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Extraction;
using HotRepl.Control;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class EntityPlanCommand : IControlCommandHandler<EntityPlanArgs, EntityPlanResult>
{
    private const int BatchSize = 100;
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;

    public EntityPlanCommand(CompendiumRunManager runs, IItemExtractionCache items)
    {
        _runs = runs;
        _items = items;
    }

    public string Name => "entity.plan";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Synchronous;

    public bool MutatesState => false;

    public ValueTask<ControlCommandResult<EntityPlanResult>> ExecuteAsync(
        ControlCommandContext context,
        EntityPlanArgs args,
        CancellationToken cancellationToken
    )
    {
        var runIdValidation = CompendiumCommandResults.RequiredString<EntityPlanResult>(
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return new(runIdValidation);
        var entityValidation = CompendiumCommandResults.RequiredString<EntityPlanResult>(
            args.Entity,
            "entity"
        );
        if (entityValidation != null) return new(entityValidation);
        if (!string.Equals(args.Entity, "item", StringComparison.Ordinal))
            return new(
                CompendiumCommandResults.Validation<EntityPlanResult>(
                    "unsupportedEntity",
                    "Only entity 'item' is supported."
                )
            );
        if (!_runs.TryGet(args.RunId, out var run))
            return new(
                CompendiumCommandResults.Validation<EntityPlanResult>(
                    "unknownRun",
                    $"Unknown run '{args.RunId}'."
                )
            );

        var total = _items.GetOrExtract(run).Count;
        var plan = run.SetEntityPlan("item", total, BatchSize);
        _runs.Save(run);
        return new(
            ControlCommandResult.Ok(
                new EntityPlanResult
                {
                    Entity = plan.Entity,
                    Total = plan.Total,
                    BatchSize = plan.BatchSize,
                    Batches = plan.Total == 0 ? 0 : (plan.Total + plan.BatchSize - 1) / plan.BatchSize,
                }
            )
        );
    }
}
